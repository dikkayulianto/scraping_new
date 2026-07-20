const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const { URL } = require('url');
const https = require('https');

// Configure Axios to ignore SSL/TLS certificate errors (resolves self-signed certificate issues for local WordPress and expired certs)
axios.defaults.httpsAgent = new https.Agent({ rejectUnauthorized: false });

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing (limit 50mb for large articles/images data payload)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Standard headers to simulate a browser request
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

// Helper: Ensure a URL is absolute
function makeAbsoluteUrl(baseUrl, relativeUrl) {
    try {
        if (!relativeUrl) return '';
        return new URL(relativeUrl, baseUrl).href;
    } catch (e) {
        return relativeUrl || '';
    }
}

// Helper: Clean and format HTML content
function cleanHtmlContent($, $container, baseUrl) {
    const excludeSelectors = [
        'script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 
        'form', 'button', 'input', 'select', 'textarea',
        'nav', 'footer', 'header', 'aside',
        '.ads', '.ad', '.advertisement', '[class*="share"]', '[class*="social"]', 
        '[class*="comment"]', '[id*="comment"]', '[id*="respond"]', '.reply',
        '.related-posts', '.popular-posts', '.newsletter', '.widget', '.sidebar'
    ];
    
    excludeSelectors.forEach(selector => {
        $container.find(selector).remove();
    });

    $container.find('img').each((i, el) => {
        const $img = $(el);
        const src = $img.attr('src');
        const dataSrc = $img.attr('data-src') || $img.attr('data-lazy-src') || $img.attr('data-original') || $img.attr('lazy-src');
        const finalSrc = makeAbsoluteUrl(baseUrl, dataSrc || src);
        
        if (finalSrc) {
            $img.attr('src', finalSrc);
            $img.removeAttr('srcset');
            $img.removeAttr('data-src');
            $img.removeAttr('data-lazy-src');
            $img.removeAttr('data-original');
            $img.attr('style', 'max-width: 100%; height: auto; border-radius: 8px; margin: 16px auto; display: block;');
        } else {
            $img.remove();
        }
    });

    $container.find('a').each((i, el) => {
        const $a = $(el);
        const href = $a.attr('href');
        if (href) {
            $a.attr('href', makeAbsoluteUrl(baseUrl, href));
            $a.attr('target', '_blank');
            $a.attr('rel', 'noopener noreferrer');
        }
    });

    $container.find('*').not('img, pre, code').each((i, el) => {
        $(el).removeAttr('style');
        $(el).removeAttr('class');
        $(el).removeAttr('id');
    });

    return $container.html();
}

// Heuristics to find the main article container
function findArticleContainer($, html) {
    const semanticContainers = ['article', '[itemprop="articleBody"]', '.post-content', '.entry-content', '.article-content', '.article-body', '#article-body', '.post-body', '.entry-body', '.main-content', '#main-content'];
    for (let selector of semanticContainers) {
        const $els = $(selector);
        if ($els.length > 0) {
            let bestEl = null;
            let maxLength = 0;
            $els.each((i, el) => {
                const textLen = $(el).text().trim().length;
                if (textLen > maxLength) {
                    maxLength = textLen;
                    bestEl = $(el);
                }
            });
            if (bestEl && maxLength > 200) {
                return bestEl;
            }
        }
    }

    let bestContainer = null;
    let maxScore = 0;

    $('div, section, main').each((i, el) => {
        const $el = $(el);
        const idOrClass = (($el.attr('class') || '') + ' ' + ($el.attr('id') || '')).toLowerCase();
        if (idOrClass.includes('sidebar') || idOrClass.includes('footer') || idOrClass.includes('nav') || idOrClass.includes('menu') || idOrClass.includes('widget') || idOrClass.includes('ad-')) {
            return;
        }

        const pCount = $el.find('p').length;
        const textLen = $el.text().trim().length;
        
        if (textLen > 200) {
            const score = (pCount * 50) + Math.min(textLen, 10000);
            if (score > maxScore) {
                maxScore = score;
                bestContainer = $el;
            }
        }
    });

    if (bestContainer && maxScore > 200) {
        return bestContainer;
    }

    return $('body');
}

// ==========================================================================
// ENDPOINT 1: SCRAPE ARTICLE FROM URL
// ==========================================================================
app.post('/api/scrape', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required.' });
    }

    try {
        new URL(url);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format.' });
    }

    const startTime = Date.now();

    try {
        const response = await axios.get(url, {
            headers: DEFAULT_HEADERS,
            timeout: 15000,
            maxRedirects: 5
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Pre-clean global layouts (Header, Footer, Sidebar, Navigation, Comments, Forms, Scripts)
        const junkLayoutSelectors = [
            'header', '#header', '.header', '.site-header', '.site-navigation', '.nav-header',
            'footer', '#footer', '.footer', '.site-footer', '.site-info', '.footer-widgets',
            'nav', '#nav', '.nav', '.navigation', '.menu', '.main-navigation', '.nav-menu', '.nav-bar', '.navbar',
            'aside', '#aside', '.aside', '.sidebar', '#sidebar', '.widget-area', '.widgets',
            '.comment-list', '.comments', '#comments', '.comment-respond', '#respond',
            '.social-share', '.share', '.sharing', '.social-media', '.social-links',
            '.related', '.related-posts', '.popular-posts', '.recommended',
            'form', 'button', 'input', 'select', 'textarea', 'iframe', 'noscript', 'style', 'script'
        ];
        junkLayoutSelectors.forEach(sel => {
            $(sel).remove();
        });

        // Extract Category
        const extractedCategories = [];
        const metaSection = $('meta[property="article:section"]').attr('content') || $('meta[name="category"]').attr('content');
        if (metaSection) {
            extractedCategories.push(metaSection.trim());
        }
        
        if (extractedCategories.length === 0) {
            const metaTags = [];
            $('meta[property="article:tag"]').each((i, el) => {
                const tagContent = $(el).attr('content');
                if (tagContent) metaTags.push(tagContent.trim());
            });
            if (metaTags.length > 0) {
                extractedCategories.push(metaTags[0]);
            }
        }

        if (extractedCategories.length === 0) {
            const catText = $('.cat-links, .entry-category, .post-category, a[rel="category tag"]').first().text().trim();
            if (catText) {
                extractedCategories.push(catText);
            }
        }

        const category = extractedCategories[0] || 'Uncategorized';

        // Extract Title and Clean It
        let rawTitle = $('meta[property="og:title"]').attr('content') || 
                       $('meta[name="twitter:title"]').attr('content') || 
                       $('meta[name="title"]').attr('content') || 
                       $('title').text().trim();
        
        if (!rawTitle) {
            const h1Selectors = [
                'article h1',
                '.entry-title',
                '.post-title',
                '.article-title',
                'h1[class*="title"]',
                '.entry-header h1'
            ];
            for (const selector of h1Selectors) {
                const text = $(selector).first().text().trim();
                if (text) {
                    rawTitle = text;
                    break;
                }
            }
        }
        
        if (!rawTitle) {
            rawTitle = $('h1').first().text().trim() || 'Untitled Article';
        }

        // Clean payment gateways, social sharing, and branding suffix from title
        let cleanTitle = rawTitle;
        if (cleanTitle) {
            const paymentGateways = ['american express', 'apple pay', 'diners club', 'discover', 'google pay', 'mastercard', 'shop pay', 'visa'];
            let lowerTitle = cleanTitle.toLowerCase();
            let firstMatchPos = -1;
            let matchCount = 0;
            
            for (const gateway of paymentGateways) {
                const pos = lowerTitle.indexOf(gateway);
                if (pos !== -1) {
                    matchCount++;
                    if (firstMatchPos === -1 || pos < firstMatchPos) {
                        firstMatchPos = pos;
                    }
                }
            }
            
            if (matchCount >= 2 && firstMatchPos > 10) {
                cleanTitle = cleanTitle.slice(0, firstMatchPos).trim();
            }
            
            cleanTitle = cleanTitle.replace(/\s*(american\s*express|apple\s*pay|diners\s*club|discover|google\s*pay|mastercard|shop\s*pay|visa|paypal|buzzfeed\s*homepage|buzzfeed|facebook|pinterest|link)+\s*$/gi, '').trim();
            
            const separators = [' | ', ' - ', ' – ', ' — ', ' • '];
            for (const sep of separators) {
                if (cleanTitle.includes(sep)) {
                    const parts = cleanTitle.split(sep);
                    const lastPart = parts[parts.length - 1].trim();
                    if (lastPart.length < 25 || lastPart.toLowerCase().includes('.com') || lastPart.toLowerCase().includes('homepage')) {
                        parts.pop();
                        cleanTitle = parts.join(sep).trim();
                    }
                }
            }
            
            cleanTitle = cleanTitle.replace(/[\s|:|•|\-|–|—]+$/, '').trim();
        }
        
        if (!cleanTitle) {
            cleanTitle = 'Untitled Article';
        }

        const metadata = {
            title: cleanTitle,
            description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
            author: $('meta[name="author"]').attr('content') || $('meta[property="article:author"]').attr('content') || $('.author').first().text().trim() || 'Unknown Author',
            publishDate: $('meta[name="publish-date"]').attr('content') || $('meta[property="article:published_time"]').attr('content') || $('time').first().attr('datetime') || $('time').first().text().trim() || '',
            siteName: $('meta[property="og:site_name"]').attr('content') || new URL(url).hostname,
            ogImage: $('meta[property="og:image"]').attr('content') || '',
            keywords: $('meta[name="keywords"]').attr('content') || '',
            category: category
        };

        const images = [];
        const seenImages = new Set();

        $('img').each((i, el) => {
            const $img = $(el);
            const src = $img.attr('src');
            const dataSrc = $img.attr('data-src') || $img.attr('data-lazy-src') || $img.attr('data-original') || $img.attr('lazy-src');
            const alt = $img.attr('alt') || '';
            const title = $img.attr('title') || '';
            
            const rawUrl = dataSrc || src;
            if (!rawUrl) return;

            const absoluteUrl = makeAbsoluteUrl(url, rawUrl);
            if (!absoluteUrl) return;

            if (seenImages.has(absoluteUrl)) return;
            seenImages.add(absoluteUrl);

            const isTracking = absoluteUrl.includes('pixel') || absoluteUrl.includes('tracker') || absoluteUrl.includes('/spacer.') || absoluteUrl.includes('/ad/') || absoluteUrl.includes('doubleclick');
            if (isTracking) return;

            let filename = 'image';
            try {
                const parsedUrl = new URL(absoluteUrl);
                const pathname = parsedUrl.pathname;
                const base = path.basename(pathname);
                if (base && base.includes('.')) {
                    filename = base;
                } else {
                    filename = `image_${i}.jpg`;
                }
            } catch (e) {}

            images.push({
                url: absoluteUrl,
                alt: alt || title || filename,
                filename: filename
            });
        });

        const $articleContainer = findArticleContainer($, html);
        const $clonedContainer = $articleContainer.clone();
        const cleanBodyHtml = cleanHtmlContent($, $clonedContainer, url);

        const textContent = cheerio.load(cleanBodyHtml).text().replace(/\s+/g, ' ').trim();
        const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
        const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

        const durationMs = Date.now() - startTime;

        res.json({
            success: true,
            url,
            metadata,
            stats: {
                wordCount,
                readTimeMinutes,
                imageCount: images.length,
                durationMs
            },
            articleHtml: cleanBodyHtml,
            articleText: textContent,
            images
        });

    } catch (err) {
        console.error(`Error scraping URL: ${url}. Details:`, err.message);
        res.status(500).json({ 
            success: false, 
            error: `Gagal memuat URL: ${err.message}. Pastikan URL dapat diakses.` 
        });
    }
});

// ==========================================================================
// ENDPOINT 2: KEYWORD SEARCH USING DUCKDUCKGO LITE
// ==========================================================================
app.post('/api/search', async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) {
        return res.status(400).json({ error: 'Keyword parameter is required.' });
    }

    try {
        // Try DuckDuckGo Lite first
        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword)}`;
            const response = await axios.get(searchUrl, {
                headers: DEFAULT_HEADERS,
                timeout: 5000
            });

            // Check if response contains blocking markers
            if (response.data.includes('aduankonten.id') || response.data.includes('internetsehatku.com') || response.data.includes('Internet Positif')) {
                throw new Error('DuckDuckGo is blocked by ISP filter.');
            }

            const $ = cheerio.load(response.data);
            const results = [];

            $('.result').each((i, el) => {
                if (i >= 8) return; // limit to top 8 search results

                const $el = $(el);
                const $titleLink = $el.find('.result__title a');
                const title = $titleLink.text().trim();
                let rawUrl = $titleLink.attr('href');
                const snippet = $el.find('.result__snippet').text().trim();

                if (title && rawUrl) {
                    // Parse duckduckgo redirect link if needed
                    if (rawUrl.startsWith('//duckduckgo.com/y.js')) {
                        try {
                            const parsed = new URL('https:' + rawUrl);
                            const u = parsed.searchParams.get('uddg');
                            if (u) rawUrl = u;
                        } catch (e) {}
                    }

                    results.push({
                        title,
                        url: rawUrl,
                        snippet
                    });
                }
            });

            if (results.length > 0) {
                return res.json({
                    success: true,
                    source: 'duckduckgo',
                    keyword,
                    results
                });
            }
            throw new Error('No results from DuckDuckGo');
        } catch (ddgErr) {
            console.log(`DuckDuckGo search failed or was blocked (${ddgErr.message}). Falling back to Yahoo Search...`);
            
            // Fallback to Yahoo Search
            const yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(keyword)}`;
            const response = await axios.get(yahooUrl, {
                headers: DEFAULT_HEADERS,
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.algo').each((i, el) => {
                if (i >= 8) return;

                const $el = $(el);
                const title = $el.find('h3').text().trim();
                const firstLink = $el.find('a').first();
                let href = firstLink.attr('href') || '';
                const snippet = $el.find('.compText, p').first().text().trim();

                // Clean Yahoo redirect link
                if (href && href.includes('/RU=')) {
                    try {
                        const match = href.match(/\/RU=([^/]+)/);
                        if (match && match[1]) {
                            href = decodeURIComponent(match[1]);
                        }
                    } catch(e) {}
                }

                if (title && href) {
                    results.push({
                        title,
                        url: href,
                        snippet
                    });
                }
            });

            return res.json({
                success: true,
                source: 'yahoo',
                keyword,
                results
            });
        }
    } catch (err) {
        console.error(`Error searching keyword "${keyword}":`, err.message);
        res.status(500).json({
            success: false,
            error: `Gagal mencari kata kunci: ${err.message}`
        });
    }
});

// ==========================================================================
// ENDPOINT 3: PUBLISH TO WORDPRESS
// ==========================================================================
app.post('/api/wp-publish', async (req, res) => {
    const { 
        wpUrl, wpUsername, wpAppPassword, title, content, status = 'draft', 
        images = [], category = 'Uncategorized', hotlinkImages = false, date = null,
        useAi = false, aiProvider = 'gemini', aiApiKey = '', aiPrompt = '' 
    } = req.body;

    if (!wpUrl || !wpUsername || !wpAppPassword || !title || !content) {
        return res.status(400).json({ error: 'Data WordPress dan artikel tidak lengkap.' });
    }

    // Normalize URL
    let baseUrl = wpUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
    }
    baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes

    // Basic Auth Header
    const token = Buffer.from(`${wpUsername.trim()}:${wpAppPassword.trim()}`).toString('base64');
    const authHeaders = {
        'Authorization': `Basic ${token}`
    };

    try {
        let aiTitle = title;
        let aiDescription = '';
        let aiContent = content;

        if (useAi && aiApiKey) {
            try {
                console.log(`[AI Rewrite] Processing article with ${aiProvider}...`);
                const systemPrompt = aiPrompt || `Tulis ulang artikel berikut ke dalam Bahasa Indonesia yang natural, informatif, dan SEO-friendly.
Format output harus tepat seperti ini:
[TITLE]: judul baru yang menarik dan SEO-friendly
[DESCRIPTION]: deskripsi singkat unik 150 karakter untuk meta description
[CONTENT]:
isi artikel yang ditulis ulang dalam format HTML, pertahankan gambar (tag <img>) dan link (tag <a>). Jangan gunakan tag <html> atau <body>, cukup isi artikelnya saja.`;

                let aiText = '';
                if (aiProvider === 'gemini') {
                    const response = await axios.post(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${aiApiKey.trim()}`,
                        {
                            contents: [{ parts: [{ text: `${systemPrompt}\n\nBerikut adalah artikel asli:\n\nJudul: ${title}\n\nKonten:\n${content}` }] }]
                        },
                        { timeout: 45000 }
                    );
                    if (response.data && response.data.candidates && response.data.candidates[0].content && response.data.candidates[0].content.parts) {
                        aiText = response.data.candidates[0].content.parts[0].text;
                    }
                } else if (aiProvider === 'openai') {
                    const response = await axios.post(
                        'https://api.openai.com/v1/chat/completions',
                        {
                            model: 'gpt-4o-mini',
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: `Judul: ${title}\n\nKonten:\n${content}` }
                            ],
                            temperature: 0.7
                        },
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${aiApiKey.trim()}`
                            },
                            timeout: 45000
                        }
                    );
                    if (response.data && response.data.choices && response.data.choices[0].message) {
                        aiText = response.data.choices[0].message.content;
                    }
                }

                if (aiText) {
                    const titleMatch = aiText.match(/\[TITLE\]:\s*(.*?)(?=\n|\[DESCRIPTION\]|\[CONTENT\]|$)/i);
                    if (titleMatch && titleMatch[1]) {
                        aiTitle = titleMatch[1].trim();
                    }

                    const descMatch = aiText.match(/\[DESCRIPTION\]:\s*(.*?)(?=\n|\[TITLE\]|\[CONTENT\]|$)/i);
                    if (descMatch && descMatch[1]) {
                        aiDescription = descMatch[1].trim();
                    }

                    const contentIndex = aiText.indexOf('[CONTENT]:');
                    if (contentIndex !== -1) {
                        aiContent = aiText.slice(contentIndex + 10).trim();
                        aiContent = aiContent.replace(/^```html\s*/i, '').replace(/```\s*$/, '').trim();
                    }
                }
                console.log(`[AI Rewrite] Successfully processed! Title: "${aiTitle.slice(0, 45)}..."`);
            } catch (aiErr) {
                console.warn('Gagal memproses rewrite AI, menggunakan konten asli. Detail:', aiErr.message);
            }
        }

        // Detect REST API path (pretty vs plain permalinks)
        let apiBase = `${baseUrl}/wp-json/wp/v2`;
        try {
            const testRes = await axios.get(`${baseUrl}/wp-json/wp/v2/posts?per_page=1`, {
                headers: authHeaders,
                timeout: 5000
            });
            const contentType = testRes.headers['content-type'] || '';
            if (!contentType.includes('application/json') || typeof testRes.data !== 'object') {
                throw new Error('Bukan respons JSON valid');
            }
        } catch (testErr) {
            // Jika REST API biasa tidak mengembalikan JSON valid (misal: redirect ke homepage), gunakan fallback plain permalinks
            apiBase = `${baseUrl}/index.php?rest_route=/wp/v2`;
        }

        // Resolving Category in WordPress
        let categoryId = null;
        if (category && category.toLowerCase() !== 'uncategorized') {
            try {
                // Search if category exists
                const catSearchUrl = apiBase.includes('?') 
                    ? `${apiBase.replace('?rest_route=/wp/v2', '')}/index.php?rest_route=/wp/v2/categories&search=${encodeURIComponent(category.trim())}`
                    : `${apiBase}/categories?search=${encodeURIComponent(category.trim())}`;
                
                const catSearchResponse = await axios.get(catSearchUrl, {
                    headers: authHeaders,
                    timeout: 8000
                });
                const existingCats = catSearchResponse.data;
                let exactMatch = null;
                
                if (existingCats && Array.isArray(existingCats)) {
                    exactMatch = existingCats.find(c => c.name.toLowerCase() === category.trim().toLowerCase());
                    
                    if (exactMatch) {
                        categoryId = exactMatch.id;
                    } else {
                        // Create new category
                        const catCreateUrl = apiBase.includes('?')
                            ? `${apiBase.replace('?rest_route=/wp/v2', '')}/index.php?rest_route=/wp/v2/categories`
                            : `${apiBase}/categories`;
                        
                        const catCreateResponse = await axios.post(catCreateUrl, {
                            name: category.trim()
                        }, {
                            headers: {
                                ...authHeaders,
                                'Content-Type': 'application/json'
                            },
                            timeout: 10000
                        });
                        
                        if (catCreateResponse.data && catCreateResponse.data.id) {
                            categoryId = catCreateResponse.data.id;
                        }
                    }
                } else {
                    console.warn(`Gagal memproses kategori "${category}": Respons REST API bukan array.`);
                }
            } catch (catErr) {
                console.warn(`Gagal memproses kategori "${category}":`, catErr.message);
            }
        }

        // 1. Upload Images to WP Media Library & Replace URLs in HTML
        const $ = cheerio.load(aiContent);
        const uploadedImages = [];
        let featuredMediaId = null;

        if (!hotlinkImages) {
            // Find all img elements in article
            const $imgs = $('img');
            
            for (let i = 0; i < $imgs.length; i++) {
                const $img = $($imgs[i]);
                const src = $img.attr('src');
                if (!src) continue;

                try {
                    // Download image buffer
                    const imgResponse = await axios.get(src, {
                        responseType: 'arraybuffer',
                        headers: DEFAULT_HEADERS,
                        timeout: 10000
                    });

                    const buffer = Buffer.from(imgResponse.data);

                    // Determine file type and name
                    const contentType = imgResponse.headers['content-type'] || 'image/jpeg';
                    let ext = 'jpg';
                    if (contentType.includes('png')) ext = 'png';
                    else if (contentType.includes('webp')) ext = 'webp';
                    else if (contentType.includes('gif')) ext = 'gif';

                    const filename = `scraped_${Date.now()}_${i}.${ext}`;

                    // Upload to WordPress Media API
                    const wpMediaUrl = `${apiBase}/media`;
                    
                    const mediaResponse = await axios.post(wpMediaUrl, buffer, {
                        headers: {
                            ...authHeaders,
                            'Content-Disposition': `attachment; filename=${filename}`,
                            'Content-Type': contentType
                        },
                        timeout: 15000
                    });

                    if (mediaResponse.data && mediaResponse.data.source_url) {
                        const newWpUrl = mediaResponse.data.source_url;
                        const mediaId = mediaResponse.data.id;

                        // Update Image Source in our HTML
                        $img.attr('src', newWpUrl);
                        
                        uploadedImages.push({
                            original: src,
                            wpUrl: newWpUrl,
                            id: mediaId
                        });

                        // Set first image as featured image
                        if (!featuredMediaId) {
                            featuredMediaId = mediaId;
                        }
                    }
                } catch (imgErr) {
                    console.warn(`Gagal mengunggah gambar ke WordPress: ${src}. Detail:`, imgErr.message);
                    // We proceed with the original hotlinked URL if upload fails
                }
            }
        }

        const finalContentHtml = $.html();

        // 2. Create the Post in WordPress
        const wpPostsUrl = `${apiBase}/posts`;
        const postData = {
            title: aiTitle,
            content: finalContentHtml,
            status,
            format: 'standard'
        };

        if (aiDescription) {
            postData.excerpt = aiDescription;
        }

        if (date) {
            postData.date = date;
        }

        if (featuredMediaId) {
            postData.featured_media = featuredMediaId;
        }

        if (categoryId) {
            postData.categories = [categoryId];
        }

        if (hotlinkImages && images && images.length > 0) {
            postData.meta = {
                _fifu_image_url: images[0],
                fifu_image_url: images[0]
            };
        }

        const postResponse = await axios.post(wpPostsUrl, postData, {
            headers: {
                ...authHeaders,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        if (!postResponse.data || typeof postResponse.data !== 'object' || !postResponse.data.id) {
            const respStr = typeof postResponse.data === 'string' ? postResponse.data : JSON.stringify(postResponse.data);
            throw new Error(`Respons WordPress tidak valid (REST API terblokir, redirect, atau salah kredensial). Halaman respons: ${respStr.slice(0, 150)}...`);
        }

        res.json({
            success: true,
            postUrl: postResponse.data.link,
            postId: postResponse.data.id,
            editUrl: `${baseUrl}/wp-admin/post.php?post=${postResponse.data.id}&action=edit`,
            status: postResponse.data.status,
            uploadedImagesCount: uploadedImages.length
        });

    } catch (err) {
        console.error('Gagal upload ke WordPress:', err.message);
        let errorDetails = err.message;
        if (err.response && err.response.data) {
            errorDetails = JSON.stringify(err.response.data);
        }
        res.status(500).json({
            success: false,
            error: `Gagal memposting ke WordPress: ${errorDetails}. Pastikan URL REST API benar dan kredensial valid.`
        });
    }
});

// ==========================================================================
// OTHER ENDPOINTS
// ==========================================================================

// Image Proxy Endpoint
app.get('/api/proxy-image', async (req, res) => {
    const imageUrl = req.query.url;

    if (!imageUrl) {
        return res.status(400).send('Image URL parameter is required.');
    }

    try {
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'stream',
            headers: {
                ...DEFAULT_HEADERS,
                'Referer': new URL(imageUrl).origin
            },
            timeout: 10000
        });

        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }
        res.setHeader('Cache-Control', 'public, max-age=86400');

        response.data.pipe(res);
    } catch (err) {
        console.error(`Error proxying image: ${imageUrl}. Details:`, err.message);
        res.status(404).send('Failed to fetch image: ' + err.message);
    }
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Image & Article Scraper & WP Publisher`);
    console.log(` Running at: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
