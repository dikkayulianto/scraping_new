// Global variables to store active scraped data
let activeScrapedData = null;
let activeImagesList = [];

// Batch Scraping Queue State
let batchQueue = [];
let isBatchRunning = false;

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();
    
    // Load Scraping History
    loadHistory();
    
    // Load WordPress Configurations
    loadWordPressConfig();
    
    // Setup Event Listeners
    setupEventListeners();
    
    // Check Theme
    initTheme();
});

// ==========================================================================
// THEME MANAGEMENT
// ==========================================================================
function initTheme() {
    const savedTheme = localStorage.getItem('scrapeflow-theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeToggleIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('scrapeflow-theme', newTheme);
    updateThemeToggleIcon(newTheme);
}

function updateThemeToggleIcon(theme) {
    const sunIcon = document.querySelector('#theme-toggle .sun-icon');
    const moonIcon = document.querySelector('#theme-toggle .moon-icon');
    if (theme === 'light') {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    } else {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }
}

// ==========================================================================
// EVENT LISTENERS SETUP
// ==========================================================================
function setupEventListeners() {
    // Sidebar Main Mode Switcher
    const modeUrlBtn = document.getElementById('mode-url-btn');
    const modeKeywordBtn = document.getElementById('mode-keyword-btn');
    const panelUrlScrape = document.getElementById('panel-url-scrape');
    const panelKeywordSearch = document.getElementById('panel-keyword-search');

    modeUrlBtn.addEventListener('click', () => {
        modeUrlBtn.classList.add('active');
        modeKeywordBtn.classList.remove('active');
        panelUrlScrape.classList.remove('hidden');
        panelKeywordSearch.classList.add('hidden');
    });

    modeKeywordBtn.addEventListener('click', () => {
        modeKeywordBtn.classList.add('active');
        modeUrlBtn.classList.remove('active');
        panelKeywordSearch.classList.remove('hidden');
        panelUrlScrape.classList.add('hidden');
    });

    // Keyword Sub-Mode Switcher (Single vs Batch Keyword)
    const subSingleBtn = document.getElementById('search-single-mode-btn');
    const subBatchBtn = document.getElementById('search-batch-mode-btn');
    const searchFormSingle = document.getElementById('search-form');
    const searchFormBatch = document.getElementById('search-batch-panel');

    subSingleBtn.addEventListener('click', () => {
        subSingleBtn.classList.add('active');
        subBatchBtn.classList.remove('active');
        searchFormSingle.classList.remove('hidden');
        searchFormBatch.classList.add('hidden');
    });

    subBatchBtn.addEventListener('click', () => {
        subBatchBtn.classList.add('active');
        subSingleBtn.classList.remove('active');
        searchFormBatch.classList.remove('hidden');
        searchFormSingle.classList.add('hidden');
    });

    // Single URL Form Submission
    const scrapeForm = document.getElementById('scrape-form');
    scrapeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const urlInput = document.getElementById('url-input');
        const url = urlInput.value.trim();
        if (url) {
            await performScrape(url);
        }
    });

    // Single Keyword Form Submission
    const searchForm = document.getElementById('search-form');
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const keywordInput = document.getElementById('keyword-input');
        const keyword = keywordInput.value.trim();
        if (keyword) {
            await performKeywordSearch(keyword);
        }
    });

    // File Input change for keyword.txt
    const fileInput = document.getElementById('batch-file-input');
    fileInput.addEventListener('change', handleKeywordFileLoad);

    // Start Batch Scraping
    document.getElementById('btn-start-batch').addEventListener('click', startBatchScraping);

    // Batch Action Exporters
    document.getElementById('btn-batch-download-zip').addEventListener('click', downloadBatchHtmlZip);
    document.getElementById('btn-batch-upload-wp').addEventListener('click', uploadBatchToWordPress);
    document.getElementById('btn-batch-reset').addEventListener('click', resetBatchDashboard);

    // WordPress Settings Save
    document.getElementById('btn-save-wp').addEventListener('click', saveWordPressConfig);

    // WordPress Publish Single Button
    document.getElementById('btn-publish-wp').addEventListener('click', publishToWordPress);

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Tab Switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Clear History Button
    document.getElementById('clear-history-btn').addEventListener('click', clearAllHistory);

    // Export Single Buttons
    document.getElementById('btn-export-md').addEventListener('click', exportToMarkdown);
    document.getElementById('btn-export-html').addEventListener('click', exportToHtml);
    document.getElementById('btn-export-txt').addEventListener('click', exportToTxt);

    // ZIP Single Download Button
    document.getElementById('btn-download-zip').addEventListener('click', downloadAllImagesZip);

    // Image Filtering
    document.getElementById('image-filter').addEventListener('change', filterImagesGrid);

    // Copy JSON
    document.getElementById('btn-copy-json').addEventListener('click', copyJsonToClipboard);

    // Error Retry Button
    document.getElementById('retry-btn').addEventListener('click', () => {
        const urlInput = document.getElementById('url-input');
        if (urlInput.value.trim()) {
            performScrape(urlInput.value.trim());
        } else {
            showViewState('welcome');
        }
    });
}

// ==========================================================================
// VIEW STATE CONTROLLER
// ==========================================================================
function showViewState(state) {
    const views = ['welcome', 'loading', 'error', 'result', 'batch'];
    views.forEach(v => {
        const el = document.getElementById(`${v}-view`);
        if (v === state) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    document.querySelector('.content-viewport').scrollTop = 0;
}

// ==========================================================================
// TAB CONTROLLER
// ==========================================================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
        if (panel.id === tabId) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });
}

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${iconName}"></i>
        </div>
        <div class="toast-message">${message}</div>
        <button class="toast-close">
            <i data-lucide="x"></i>
        </button>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4500);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
    });
}

// ==========================================================================
// WORDPRESS CONFIGURATION MANAGER
// ==========================================================================
function saveWordPressConfig() {
    const wpUrl = document.getElementById('wp-url').value.trim();
    const wpUser = document.getElementById('wp-user').value.trim();
    const wpPass = document.getElementById('wp-pass').value.trim();
    const wpHotlink = document.getElementById('wp-hotlink-images').checked;

    localStorage.setItem('scrapeflow-wp-url', wpUrl);
    localStorage.setItem('scrapeflow-wp-user', wpUser);
    localStorage.setItem('scrapeflow-wp-pass', wpPass);
    localStorage.setItem('scrapeflow-wp-hotlink', wpHotlink ? 'true' : 'false');

    showToast('Kredensial WordPress disimpan!', 'success');
}

function loadWordPressConfig() {
    document.getElementById('wp-url').value = localStorage.getItem('scrapeflow-wp-url') || '';
    document.getElementById('wp-user').value = localStorage.getItem('scrapeflow-wp-user') || '';
    document.getElementById('wp-pass').value = localStorage.getItem('scrapeflow-wp-pass') || '';
    document.getElementById('wp-hotlink-images').checked = localStorage.getItem('scrapeflow-wp-hotlink') === 'true';
}

// ==========================================================================
// FILE LOADER FOR KEYWORDS
// ==========================================================================
function handleKeywordFileLoad(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        const text = evt.target.result;
        
        // Parse keywords: split by line break and trim
        const lines = text.split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length > 0) {
            document.getElementById('batch-keywords-textarea').value = lines.join('\n');
            showToast(`Berhasil memuat ${lines.length} kata kunci dari file!`, 'success');
        } else {
            showToast('File kosong atau format tidak sesuai.', 'error');
        }
    };
    reader.readAsText(file);
}

// ==========================================================================
// BATCH ENGINE: CRAWLER & SCRAPER QUEUE
// ==========================================================================
async function startBatchScraping() {
    if (isBatchRunning) return;

    const textarea = document.getElementById('batch-keywords-textarea');
    const rawText = textarea.value.trim();
    if (!rawText) {
        showToast('Silakan isi kata kunci terlebih dahulu!', 'error');
        return;
    }

    const keywords = rawText.split(/\n/)
        .map(kw => kw.trim())
        .filter(kw => kw.length > 0);

    if (keywords.length === 0) {
        showToast('Daftar kata kunci kosong.', 'error');
        return;
    }

    const limit = parseInt(document.getElementById('batch-articles-limit').value) || 3;

    // Set State
    isBatchRunning = true;
    batchQueue = [];
    
    // Hide old banners & actions
    document.getElementById('batch-actions-panel').classList.add('hidden');
    document.getElementById('batch-wp-results-container').classList.add('hidden');
    document.getElementById('batch-wp-results-list').innerHTML = '';

    // Switch View State
    showViewState('batch');

    // UI elements
    const progressText = document.getElementById('batch-progress-text');
    const progressBar = document.getElementById('batch-progress-bar-fill');
    const tbody = document.getElementById('batch-queue-tbody');

    tbody.innerHTML = '';
    progressBar.style.width = '0%';

    // Phase 1: Search Expansion
    progressText.textContent = 'Memulai Fase 1: Mencari artikel untuk kata kunci...';
    
    let queueIndex = 0;
    const totalKeywords = keywords.length;

    for (let i = 0; i < totalKeywords; i++) {
        const kw = keywords[i];
        progressText.textContent = `Mencari artikel untuk keyword: "${kw}" (${i + 1}/${totalKeywords})...`;
        
        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword: kw })
            });
            const data = await response.json();

            if (response.ok && data.success && data.results && data.results.length > 0) {
                // Slice search results based on user limit
                const selectedResults = data.results.slice(0, limit);
                
                selectedResults.forEach((resItem, idx) => {
                    batchQueue.push({
                        index: queueIndex,
                        keyword: `${kw} (Hasil #${idx + 1})`,
                        originalKeyword: kw,
                        resultIndex: idx + 1,
                        url: resItem.url,
                        title: resItem.title,
                        snippet: resItem.snippet,
                        status: 'waiting',
                        articleHtml: '',
                        articleText: '',
                        images: [],
                        stats: null,
                        source: data.source
                    });

                    // Add a waiting row to the UI table immediately
                    const tr = document.createElement('tr');
                    tr.id = `batch-row-${queueIndex}`;
                    tr.innerHTML = `
                        <td>${queueIndex + 1}</td>
                        <td title="${kw} (Hasil #${idx + 1})">${kw} <span class="text-muted" style="font-size:0.75rem;">(Hasil #${idx + 1})</span></td>
                        <td><span class="status-badge status-waiting">Antre</span></td>
                        <td title="${resItem.title}">${resItem.title}</td>
                        <td>-</td>
                        <td>-</td>
                    `;
                    tbody.appendChild(tr);
                    queueIndex++;
                });
            } else {
                console.warn(`Keyword search yielded 0 results for: "${kw}"`);
                const tr = document.createElement('tr');
                tr.id = `batch-row-fail-${i}`;
                tr.innerHTML = `
                    <td>-</td>
                    <td>${kw}</td>
                    <td><span class="status-badge status-error">Gagal Cari</span></td>
                    <td style="color:var(--accent-red)">Hasil pencarian kosong atau diblokir.</td>
                    <td>-</td>
                    <td>-</td>
                `;
                tbody.appendChild(tr);
            }
        } catch (e) {
            console.error(`Search phase error for: "${kw}"`, e.message);
            const tr = document.createElement('tr');
            tr.id = `batch-row-fail-${i}`;
            tr.innerHTML = `
                <td>-</td>
                <td>${kw}</td>
                <td><span class="status-badge status-error">Error Cari</span></td>
                <td style="color:var(--accent-red)">Gagal terhubung: ${e.message}</td>
                <td>-</td>
                <td>-</td>
            `;
            tbody.appendChild(tr);
        }
        lucide.createIcons();
    }

    const totalQueueItems = batchQueue.length;
    document.getElementById('batch-stat-total').textContent = totalQueueItems;

    if (totalQueueItems === 0) {
        isBatchRunning = false;
        progressText.textContent = 'Fase Pencarian selesai. Tidak ada artikel yang ditemukan untuk diekstrak.';
        showToast('Tidak ada artikel yang dapat diekstrak.', 'error');
        return;
    }

    // Phase 2: Sequential Scraping
    progressText.textContent = `Memulai Fase 2: Mengekstrak ${totalQueueItems} artikel...`;
    
    let countSuccess = 0;
    let countFailed = 0;
    let totalWords = 0;

    document.getElementById('batch-stat-success').textContent = 0;
    document.getElementById('batch-stat-failed').textContent = 0;
    document.getElementById('batch-stat-words').textContent = 0;

    for (let i = 0; i < totalQueueItems; i++) {
        const item = batchQueue[i];
        
        progressText.textContent = `Mengekstrak artikel ${i + 1} dari ${totalQueueItems}: "${item.title}"...`;
        updateQueueRowUI(i, 'processing', item.title);

        try {
            const scrapeResponse = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: item.url })
            });
            const scrapeData = await scrapeResponse.json();

            if (!scrapeResponse.ok || !scrapeData.success) {
                throw new Error(scrapeData.error || 'Scraping gagal.');
            }

            // Save details
            item.status = 'success';
            item.title = scrapeData.metadata.title; // update to scraped actual title
            item.articleHtml = scrapeData.articleHtml;
            item.articleText = scrapeData.articleText;
            item.images = scrapeData.images;
            item.stats = scrapeData.stats;
            item.category = scrapeData.metadata.category || 'Uncategorized';

            countSuccess++;
            totalWords += scrapeData.stats.wordCount;

            updateQueueRowUI(i, 'success', item.title, `${scrapeData.stats.wordCount} kata / ${scrapeData.stats.imageCount} gbr`, item.source);

        } catch (err) {
            console.error(`Error on batch scrape item #${i} (${item.url}):`, err.message);
            item.status = 'failed';
            item.error = err.message;
            countFailed++;
            updateQueueRowUI(i, 'failed', `Gagal: ${err.message}`);
        }

        // Update UI stats
        document.getElementById('batch-stat-success').textContent = countSuccess;
        document.getElementById('batch-stat-failed').textContent = countFailed;
        document.getElementById('batch-stat-words').textContent = totalWords.toLocaleString();

        // Update progress bar
        const percentage = Math.ceil(((i + 1) / totalQueueItems) * 100);
        progressBar.style.width = `${percentage}%`;
    }

    // Complete Run
    isBatchRunning = false;
    progressText.textContent = `Batch selesai! Sukses: ${countSuccess}, Gagal: ${countFailed}.`;
    showToast('Batch scraping selesai!', 'success');

    // Reveal Action Panel
    document.getElementById('batch-actions-panel').classList.remove('hidden');
    lucide.createIcons();
}

function updateQueueRowUI(index, status, titleText = '-', statsText = '-', source = '-') {
    const tr = document.getElementById(`batch-row-${index}`);
    if (!tr) return;

    let badgeClass = 'status-waiting';
    let statusLabel = 'Antre';

    if (status === 'processing') {
        badgeClass = 'status-processing';
        statusLabel = 'Memproses';
    } else if (status === 'success') {
        badgeClass = 'status-success';
        statusLabel = 'Sukses';
    } else if (status === 'failed') {
        badgeClass = 'status-error';
        statusLabel = 'Gagal';
    }

    const item = batchQueue[index];
    const urlDisplay = item.url ? `<a href="${item.url}" target="_blank" style="font-size:0.7rem;opacity:0.8;word-break:break-all;">${new URL(item.url).hostname} <i data-lucide="external-link" style="width:10px;height:10px;display:inline-block;"></i></a>` : '-';

    tr.innerHTML = `
        <td>${index + 1}</td>
        <td title="${item.keyword}">${item.keyword}</td>
        <td><span class="status-badge ${badgeClass}">${statusLabel}</span></td>
        <td title="${titleText}">${titleText}</td>
        <td>${statsText}</td>
        <td>${status === 'success' ? `${urlDisplay} (${source})` : (status === 'processing' ? titleText : '-')}</td>
    `;
    lucide.createIcons();
}

function resetBatchDashboard() {
    if (isBatchRunning) {
        if (!confirm('Proses batch sedang berjalan. Apakah Anda ingin menghentikannya?')) return;
    }
    isBatchRunning = false;
    showViewState('welcome');
}

// ==========================================================================
// EXPORTS BATCH TO ZIP (HTML CLEAN DOCUMENTS)
// ==========================================================================
async function downloadBatchHtmlZip() {
    const successItems = batchQueue.filter(item => item.status === 'success');
    if (successItems.length === 0) {
        showToast('Tidak ada artikel sukses untuk diunduh.', 'error');
        return;
    }

    const downloadBtn = document.getElementById('btn-batch-download-zip');
    const btnText = downloadBtn.querySelector('.btn-batch-zip-text');
    const btnSpinner = downloadBtn.querySelector('.btn-batch-zip-spinner');

    downloadBtn.disabled = true;
    btnSpinner.classList.remove('hidden');
    btnText.innerHTML = `<i data-lucide="loader" class="spin"></i> Memaketkan ZIP...`;
    lucide.createIcons();

    const zip = new JSZip();
    const folder = zip.folder("scraped_articles");

    successItems.forEach(item => {
        // Build styled standalone HTML document for each article
        const htmlDoc = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${item.title}</title>
    <style>
        body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.8; color: #1f2937; background-color: #f9fafb; padding: 40px 20px; margin: 0; }
        .container { max-width: 740px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        h1 { font-size: 2.25rem; font-weight: 800; color: #111827; margin-bottom: 20px; }
        .meta { font-size: 0.875rem; color: #6b7280; margin-bottom: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; }
        .meta a { color: #4f46e5; text-decoration: none; }
        .content { font-size: 1.125rem; color: #374151; }
        p { margin-bottom: 24px; }
        h2 { font-size: 1.5rem; margin-top: 40px; margin-bottom: 16px; color: #111827; }
        h3 { font-size: 1.25rem; margin-top: 32px; margin-bottom: 12px; color: #111827; }
        blockquote { border-left: 4px solid #4f46e5; padding: 10px 20px; background-color: #f3f4f6; margin: 24px 0; border-radius: 0 8px 8px 0; font-style: italic; }
        img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 24px auto; }
        pre { background-color: #1f2937; color: #f9fafb; padding: 20px; border-radius: 8px; overflow-x: auto; }
        code { font-family: monospace; background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
        pre code { background-color: transparent; padding: 0; color: inherit; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${item.title}</h1>
        <div class="meta">
            <strong>Keyword Pencarian:</strong> ${item.keyword} &bull; 
            ${item.category ? `<strong>Kategori:</strong> ${item.category} &bull; ` : ''}
            <strong>Sumber:</strong> <a href="${item.url}" target="_blank">${item.url}</a>
        </div>
        <div class="content">
            ${item.articleHtml}
        </div>
    </div>
</body>
</html>`;

        const filename = `${item.index + 1}_${item.keyword.toLowerCase().replace(/[^a-z0-9]/g, '_')}.html`;
        folder.file(filename, htmlDoc);
    });

    try {
        const content = await zip.generateAsync({ type: "blob" });
        triggerFileDownload(content, `scrapeflow_batch_${Date.now()}.zip`, "application/zip");
        showToast('ZIP berisi artikel HTML berhasil diunduh!', 'success');
    } catch (e) {
        showToast('Gagal mengompresi ZIP: ' + e.message, 'error');
    } finally {
        downloadBtn.disabled = false;
        btnText.innerHTML = `<i data-lucide="archive"></i> Download ZIP (HTML Lengkap)`;
        btnSpinner.classList.add('hidden');
        lucide.createIcons();
    }
}

// ==========================================================================
// BULK PUBLISH TO WORDPRESS
// ==========================================================================
async function uploadBatchToWordPress() {
    const successItems = batchQueue.filter(item => item.status === 'success');
    if (successItems.length === 0) {
        showToast('Tidak ada artikel sukses untuk diunggah.', 'error');
        return;
    }

    const wpUrl = document.getElementById('wp-url').value.trim();
    const wpUser = document.getElementById('wp-user').value.trim();
    const wpPass = document.getElementById('wp-pass').value.trim();
    const status = document.getElementById('wp-batch-post-status').value;
    const wpHotlink = document.getElementById('wp-hotlink-images').checked;

    if (!wpUrl || !wpUser || !wpPass) {
        showToast('Silakan lengkapi Kredensial WordPress Anda di panel kiri!', 'error');
        return;
    }

    const uploadBtn = document.getElementById('btn-batch-upload-wp');
    const btnText = uploadBtn.querySelector('.btn-batch-pub-text');
    const btnSpinner = uploadBtn.querySelector('.btn-batch-pub-spinner');

    uploadBtn.disabled = true;
    btnSpinner.classList.remove('hidden');

    const resultsContainer = document.getElementById('batch-wp-results-container');
    const resultsList = document.getElementById('batch-wp-results-list');

    resultsContainer.classList.remove('hidden');
    resultsList.innerHTML = '';

    showToast('Memulai upload massal ke WordPress...', 'info');

    const totalCount = successItems.length;

    for (let i = 0; i < totalCount; i++) {
        const item = successItems[i];
        btnText.innerHTML = `Mengunggah ${i + 1}/${totalCount}...`;

        // Render progress row in report
        const reportRow = document.createElement('div');
        reportRow.className = 'wp-result-item';
        reportRow.id = `wp-report-row-${item.index}`;
        reportRow.innerHTML = `
            <span class="wp-result-title-link">Posting: "${item.title}"</span>
            <span class="status-badge status-processing">Mengunggah...</span>
        `;
        resultsList.appendChild(reportRow);

        try {
            const response = await fetch('/api/wp-publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wpUrl,
                    wpUsername: wpUser,
                    wpAppPassword: wpPass,
                    title: item.title,
                    content: item.articleHtml,
                    status,
                    images: item.images.map(img => img.url),
                    category: item.category || 'Uncategorized',
                    hotlinkImages: wpHotlink
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update report row to success with links
                reportRow.innerHTML = `
                    <span class="wp-result-title-link">${item.title}</span>
                    <div class="wp-result-actions">
                        <a href="${data.postUrl}" target="_blank" class="btn btn-sm btn-secondary">
                            <i data-lucide="eye"></i> Lihat
                        </a>
                        <a href="${data.editUrl}" target="_blank" class="btn btn-sm btn-primary">
                            <i data-lucide="edit-3"></i> Edit
                        </a>
                    </div>
                `;
            } else {
                throw new Error(data.error || 'Upload fail');
            }
        } catch (e) {
            console.error(`Gagal upload WP item #${item.index}:`, e.message);
            reportRow.innerHTML = `
                <span class="wp-result-title-link" style="color:var(--accent-red)">Gagal: "${item.title}"</span>
                <span class="status-badge status-error" title="${e.message}">Gagal</span>
            `;
        }
        lucide.createIcons();
    }

    // Bulk Upload Completed
    uploadBtn.disabled = false;
    btnText.textContent = "Upload Massal";
    btnSpinner.classList.add('hidden');
    showToast('Auto-Publish massal selesai!', 'success');
}

// ==========================================================================
// SINGLE URL FLOW
// ==========================================================================
async function performScrape(url) {
    showViewState('loading');
    document.getElementById('wp-success-banner').classList.add('hidden');

    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    submitBtn.disabled = true;
    btnText.textContent = "Scraping...";
    btnSpinner.classList.remove('hidden');

    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            activeScrapedData = data;
            activeImagesList = data.images;

            populateScrapedData(data);
            saveToHistory(url, data.metadata.title);
            showViewState('result');
            showToast('Scraping selesai dengan sukses!', 'success');
        } else {
            throw new Error(data.error || 'Terjadi kesalahan internal server.');
        }
    } catch (err) {
        console.error(err);
        document.getElementById('error-message').textContent = err.message;
        showViewState('error');
        showToast('Proses scraping gagal.', 'error');
    } finally {
        submitBtn.disabled = false;
        btnText.textContent = "Ekstrak Konten";
        btnSpinner.classList.add('hidden');
    }
}

// ==========================================================================
// SINGLE KEYWORD SEARCH FLOW
// ==========================================================================
async function performKeywordSearch(keyword) {
    const searchBtn = document.getElementById('search-btn');
    const btnText = searchBtn.querySelector('.search-btn-text');
    const btnSpinner = searchBtn.querySelector('.search-btn-spinner');

    searchBtn.disabled = true;
    btnText.textContent = "Mencari...";
    btnSpinner.classList.remove('hidden');

    const resultsContainer = document.getElementById('search-results-container');
    const resultsList = document.getElementById('search-results-list');

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            resultsList.innerHTML = '';
            
            if (!data.results || data.results.length === 0) {
                resultsList.innerHTML = '<p class="text-muted" style="font-size:0.75rem;padding:10px;text-align:center;">Tidak ada artikel yang ditemukan.</p>';
            } else {
                data.results.forEach((item) => {
                    const card = document.createElement('div');
                    card.className = 'search-result-card';
                    card.innerHTML = `
                        <div class="search-result-title" title="${item.title}">${item.title}</div>
                        <div class="search-result-desc">${item.snippet || 'Tanpa deskripsi.'}</div>
                        <button class="btn btn-sm btn-primary scrape-load-btn" data-url="${item.url}">
                            <i data-lucide="download"></i> Scrape &amp; Muat
                        </button>
                    `;

                    card.querySelector('.scrape-load-btn').addEventListener('click', () => {
                        document.getElementById('url-input').value = item.url;
                        performScrape(item.url);
                    });

                    resultsList.appendChild(card);
                });
            }

            resultsContainer.classList.remove('hidden');
            lucide.createIcons();
            showToast(`Ditemukan ${data.results.length} artikel (${data.source})!`, 'success');
        } else {
            throw new Error(data.error || 'Terjadi kesalahan saat mencari keyword.');
        }
    } catch (e) {
        console.error(e);
        showToast('Pencarian gagal: ' + e.message, 'error');
    } finally {
        searchBtn.disabled = false;
        btnText.textContent = "Cari Artikel";
        btnSpinner.classList.add('hidden');
    }
}

// ==========================================================================
// PUBLISH SINGLE POST TO WORDPRESS FLOW
// ==========================================================================
async function publishToWordPress() {
    if (!activeScrapedData) {
        showToast('Belum ada artikel yang di-scrape.', 'error');
        return;
    }

    const wpUrl = document.getElementById('wp-url').value.trim();
    const wpUser = document.getElementById('wp-user').value.trim();
    const wpPass = document.getElementById('wp-pass').value.trim();
    const status = document.getElementById('wp-post-status').value;
    const wpHotlink = document.getElementById('wp-hotlink-images').checked;

    if (!wpUrl || !wpUser || !wpPass) {
        showToast('Silakan isi kredensial WordPress Anda terlebih dahulu!', 'error');
        return;
    }

    const publishBtn = document.getElementById('btn-publish-wp');
    const btnText = publishBtn.querySelector('.btn-pub-text');
    const btnSpinner = publishBtn.querySelector('.btn-pub-spinner');

    publishBtn.disabled = true;
    btnText.textContent = "Mengunggah...";
    btnSpinner.classList.remove('hidden');
    document.getElementById('wp-success-banner').classList.add('hidden');

    showToast('Sedang memproses gambar & postingan ke WordPress...', 'info');

    try {
        const response = await fetch('/api/wp-publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wpUrl,
                wpUsername: wpUser,
                wpAppPassword: wpPass,
                title: activeScrapedData.metadata.title,
                content: activeScrapedData.articleHtml,
                status,
                images: activeImagesList.map(img => img.url),
                category: activeScrapedData.metadata.category || 'Uncategorized',
                hotlinkImages: wpHotlink
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            const banner = document.getElementById('wp-success-banner');
            document.getElementById('wp-banner-status').textContent = data.status;
            document.getElementById('wp-link-view').href = data.postUrl;
            document.getElementById('wp-link-edit').href = data.editUrl;
            banner.classList.remove('hidden');

            document.querySelector('.content-viewport').scrollTop = 0;
            showToast(`Artikel terbit di WordPress! Status: ${data.status}`, 'success');
        } else {
            throw new Error(data.error || 'Terjadi kesalahan saat memposting.');
        }
    } catch (e) {
        console.error(e);
        showToast('Gagal mempublikasikan: ' + e.message, 'error');
    } finally {
        publishBtn.disabled = false;
        btnText.textContent = "Posting Sekarang";
        btnSpinner.classList.add('hidden');
    }
}

// ==========================================================================
// RENDER SCRAPED DATA (SINGLE MODE)
// ==========================================================================
function populateScrapedData(data) {
    document.getElementById('url-header-container').classList.remove('hidden');
    const headerLink = document.getElementById('url-header-link');
    const headerText = document.getElementById('url-header-text');
    headerLink.href = data.url;
    headerText.textContent = data.url;

    document.getElementById('meta-site-name').textContent = data.metadata.siteName;
    document.getElementById('meta-title').textContent = data.metadata.title;
    document.getElementById('meta-author').textContent = data.metadata.author || 'Tidak Diketahui';
    document.getElementById('meta-date').textContent = formatDateString(data.metadata.publishDate) || 'Tanpa Tanggal';
    document.getElementById('meta-category').textContent = data.metadata.category || 'Uncategorized';

    document.getElementById('stat-words').textContent = data.stats.wordCount.toLocaleString();
    document.getElementById('stat-read-time').textContent = `${data.stats.readTimeMinutes} mnt`;
    document.getElementById('stat-images').textContent = data.stats.imageCount;
    document.getElementById('stat-duration').textContent = `${data.stats.durationMs}ms`;

    document.getElementById('tab-img-count').textContent = data.stats.imageCount;

    const bodyContent = document.getElementById('article-body-content');
    if (data.articleHtml) {
        bodyContent.innerHTML = data.articleHtml;
    } else {
        bodyContent.innerHTML = `<p class="text-muted">Gagal mengekstrak isi artikel terformat.</p><p>${data.articleText || ''}</p>`;
    }

    document.getElementById('image-filter').value = 'all';
    renderImageGallery(data.images);
    populateMetadataTable(data.metadata);
    document.getElementById('raw-json-block').textContent = JSON.stringify(data, null, 2);

    switchTab('tab-article');
}

// Helper: Format Date String
function formatDateString(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

// Render Images to Gallery Grid
function renderImageGallery(images) {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';

    if (!images || images.length === 0) {
        grid.innerHTML = `
            <div class="empty-history" style="grid-column: 1/-1; padding: 60px 0;">
                <i data-lucide="image-off" style="width: 48px; height: 48px;"></i>
                <p>Tidak ada gambar yang ditemukan.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    images.forEach((img, idx) => {
        let ext = 'unknown';
        const extMatch = img.url.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp)(?:\?|$)/i);
        if (extMatch) {
            ext = extMatch[1].toLowerCase();
        }
        
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(img.url)}`;

        const card = document.createElement('div');
        card.className = 'image-card';
        card.dataset.ext = ext;
        card.innerHTML = `
            <div class="image-preview-box">
                <img src="${proxyUrl}" alt="${img.alt || 'Scraped'}" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22><text y=%2250%%22 x=%2250%%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2212%22 fill=%22%23999%22>Gagal Memuat</text></svg>'">
                <span class="image-format-badge">${ext}</span>
            </div>
            <div class="image-details">
                <div class="image-name" title="${img.filename}">${img.filename}</div>
                <div class="image-dimensions">Index: #${idx + 1}</div>
                <div class="image-actions">
                    <a href="${img.url}" target="_blank" class="btn btn-sm btn-outline">
                        <i data-lucide="external-link"></i> Sumber
                    </a>
                    <button class="btn btn-sm btn-primary download-single-btn" data-url="${img.url}" data-filename="${img.filename}">
                        <i data-lucide="download"></i> Simpan
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    grid.querySelectorAll('.download-single-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const rawUrl = btn.getAttribute('data-url');
            const filename = btn.getAttribute('data-filename');
            downloadSingleImage(rawUrl, filename);
        });
    });

    lucide.createIcons();
}

// Filter gallery images by format
function filterImagesGrid() {
    const filterValue = document.getElementById('image-filter').value;
    const cards = document.querySelectorAll('#gallery-grid .image-card');

    cards.forEach(card => {
        if (filterValue === 'all') {
            card.classList.remove('hidden');
        } else {
            const ext = card.dataset.ext;
            const checkExt = ext === 'jpeg' ? 'jpg' : ext;
            const targetFilter = filterValue === 'jpeg' ? 'jpg' : filterValue;

            if (checkExt === targetFilter) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        }
    });
}

// Populate metadata table
function populateMetadataTable(meta) {
    const tbody = document.getElementById('meta-tags-tbody');
    tbody.innerHTML = '';

    const displayKeys = {
        title: 'Title Tag',
        description: 'Meta Description',
        author: 'Author',
        publishDate: 'Published Time',
        siteName: 'Site Name (og:site_name)',
        ogImage: 'og:image (Open Graph Cover)',
        keywords: 'Meta Keywords'
    };

    Object.keys(displayKeys).forEach(key => {
        const tr = document.createElement('tr');
        const value = meta[key] || '<span class="text-muted" style="font-style: italic;">Tidak terdefinisi</span>';
        
        let formattedVal = value;
        if (key === 'ogImage' && meta[key]) {
            formattedVal = `<a href="${meta[key]}" target="_blank" style="word-break: break-all;">${meta[key]} <i data-lucide="external-link" style="width:12px;height:12px;display:inline-block;vertical-align:middle;"></i></a>`;
        }

        tr.innerHTML = `
            <td>${displayKeys[key]}</td>
            <td>${formattedVal}</td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
}

// Copy JSON
function copyJsonToClipboard() {
    if (!activeScrapedData) return;
    const jsonStr = JSON.stringify(activeScrapedData, null, 2);
    navigator.clipboard.writeText(jsonStr)
        .then(() => showToast('JSON berhasil disalin ke clipboard!', 'success'))
        .catch(err => showToast('Gagal menyalin JSON: ' + err.message, 'error'));
}

// ==========================================================================
// EXPORTERS
// ==========================================================================
function triggerFileDownload(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

function exportToMarkdown() {
    if (!activeScrapedData) return;
    
    const meta = activeScrapedData.metadata;
    const title = meta.title;
    
    let md = `# ${title}\n\n`;
    if (meta.author) md += `**Penulis:** ${meta.author}  \n`;
    if (meta.publishDate) md += `**Tanggal:** ${formatDateString(meta.publishDate)}  \n`;
    if (meta.category) md += `**Kategori:** ${meta.category}  \n`;
    md += `**Sumber:** [${meta.siteName}](${activeScrapedData.url})\n\n`;
    md += `---\n\n`;

    const bodyContent = document.getElementById('article-body-content');
    md += htmlToMarkdown(bodyContent);

    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
    triggerFileDownload(md, `${safeTitle || 'artikel'}.md`, 'text/markdown;charset=utf-8');
    showToast('Artikel diekspor sebagai Markdown!', 'success');
}

function exportToHtml() {
    if (!activeScrapedData) return;

    const meta = activeScrapedData.metadata;
    const title = meta.title;

    const standaloneHtml = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.8; color: #1f2937; background-color: #f9fafb; padding: 40px 20px; margin: 0; }
        .container { max-width: 740px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb; }
        h1 { font-size: 2.25rem; font-weight: 800; color: #111827; margin-bottom: 20px; }
        .meta { font-size: 0.875rem; color: #6b7280; margin-bottom: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; }
        .meta a { color: #4f46e5; text-decoration: none; }
        .content { font-size: 1.125rem; color: #374151; }
        p { margin-bottom: 24px; }
        h2 { font-size: 1.5rem; margin-top: 40px; margin-bottom: 16px; color: #111827; }
        h3 { font-size: 1.25rem; margin-top: 32px; margin-bottom: 12px; color: #111827; }
        blockquote { border-left: 4px solid #4f46e5; padding: 10px 20px; background-color: #f3f4f6; margin: 24px 0; border-radius: 0 8px 8px 0; font-style: italic; }
        img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 24px auto; }
        pre { background-color: #1f2937; color: #f9fafb; padding: 20px; border-radius: 8px; overflow-x: auto; }
        code { font-family: monospace; background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
        pre code { background-color: transparent; padding: 0; color: inherit; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <div class="meta">
            ${meta.author ? `<strong>Penulis:</strong> ${meta.author} &bull; ` : ''}
            ${meta.publishDate ? `<strong>Tanggal:</strong> ${formatDateString(meta.publishDate)} &bull; ` : ''}
            ${meta.category ? `<strong>Kategori:</strong> ${meta.category} &bull; ` : ''}
            <strong>Sumber:</strong> <a href="${activeScrapedData.url}" target="_blank">${meta.siteName}</a>
        </div>
        <div class="content">
            ${activeScrapedData.articleHtml}
        </div>
    </div>
</body>
</html>`;

    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
    triggerFileDownload(standaloneHtml, `${safeTitle || 'artikel'}.html`, 'text/html;charset=utf-8');
    showToast('Artikel diekspor sebagai HTML!', 'success');
}

function exportToTxt() {
    if (!activeScrapedData || !activeScrapedData.articleText) return;

    const meta = activeScrapedData.metadata;
    const title = meta.title;

    let txt = `${title.toUpperCase()}\n`;
    txt += `=========================================\n`;
    if (meta.author) txt += `Penulis: ${meta.author}\n`;
    if (meta.publishDate) txt += `Tanggal: ${formatDateString(meta.publishDate)}\n`;
    txt += `Sumber: ${activeScrapedData.url}\n`;
    txt += `=========================================\n\n`;
    txt += activeScrapedData.articleText;

    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
    triggerFileDownload(txt, `${safeTitle || 'artikel'}.txt`, 'text/plain;charset=utf-8');
    showToast('Artikel diekspor sebagai Text!', 'success');
}

// Convert HTML to Markdown
function htmlToMarkdown(element) {
    let md = '';
    const childNodes = element.childNodes;
    
    childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            md += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            
            switch (tagName) {
                case 'p':
                    md += `\n\n${htmlToMarkdown(node)}`;
                    break;
                case 'h1':
                    md += `\n\n# ${htmlToMarkdown(node)}`;
                    break;
                case 'h2':
                    md += `\n\n## ${htmlToMarkdown(node)}`;
                    break;
                case 'h3':
                    md += `\n\n### ${htmlToMarkdown(node)}`;
                    break;
                case 'h4':
                    md += `\n\n#### ${htmlToMarkdown(node)}`;
                    break;
                case 'strong':
                case 'b':
                    md += `**${htmlToMarkdown(node)}**`;
                    break;
                case 'em':
                case 'i':
                    md += `*${htmlToMarkdown(node)}*`;
                    break;
                case 'blockquote':
                    md += `\n\n> ${htmlToMarkdown(node).replace(/\n/g, '\n> ')}`;
                    break;
                case 'ul':
                case 'ol':
                    md += `\n${htmlToMarkdown(node)}`;
                    break;
                case 'li':
                    const parent = node.parentNode.tagName.toLowerCase();
                    if (parent === 'ol') {
                        const index = Array.from(node.parentNode.children).indexOf(node) + 1;
                        md += `\n${index}. ${htmlToMarkdown(node)}`;
                    } else {
                        md += `\n- ${htmlToMarkdown(node)}`;
                    }
                    break;
                case 'pre':
                    md += `\n\n\`\`\`\n${node.textContent.trim()}\n\`\`\``;
                    break;
                case 'code':
                    if (node.parentNode.tagName.toLowerCase() !== 'pre') {
                        md += ` \`${node.textContent}\` `;
                    } else {
                        md += node.textContent;
                    }
                    break;
                case 'img':
                    const alt = node.getAttribute('alt') || 'image';
                    const src = node.getAttribute('src');
                    md += `\n\n![${alt}](${src})`;
                    break;
                case 'a':
                    const href = node.getAttribute('href');
                    md += `[${htmlToMarkdown(node)}](${href})`;
                    break;
                case 'br':
                    md += `  \n`;
                    break;
                default:
                    md += htmlToMarkdown(node);
                    break;
            }
        }
    });
    
    return md;
}

// Download single image
async function downloadSingleImage(imageUrl, filename) {
    try {
        showToast('Mengunduh gambar...', 'info');
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error('Proxy fail');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'download.jpg';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
        
        showToast('Gambar berhasil disimpan!', 'success');
    } catch (e) {
        console.error(e);
        showToast('Gagal mengunduh gambar: ' + e.message, 'error');
    }
}

// Download images as ZIP
async function downloadAllImagesZip() {
    if (!activeImagesList || activeImagesList.length === 0) {
        showToast('Tidak ada gambar untuk di-zip.', 'error');
        return;
    }

    const zipBtn = document.getElementById('btn-download-zip');
    const zipBtnText = zipBtn.querySelector('.btn-zip-text');
    const zipBtnSpinner = zipBtn.querySelector('.btn-zip-spinner');
    
    zipBtn.disabled = true;
    zipBtnSpinner.classList.remove('hidden');
    
    showToast('Mengunduh & memaketkan gambar...', 'info');

    const zip = new JSZip();
    const folder = zip.folder("scrapeflow_images");
    let downloadedCount = 0;
    const totalCount = activeImagesList.length;
    const nameMap = new Map();

    for (let i = 0; i < activeImagesList.length; i++) {
        const img = activeImagesList[i];
        zipBtnText.innerHTML = `<i data-lucide="loader" class="spin"></i> Downloading ${i + 1}/${totalCount}...`;
        
        try {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(img.url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error();
            const blob = await response.blob();
            
            let finalName = img.filename || `image_${i}.jpg`;
            if (nameMap.has(finalName)) {
                const count = nameMap.get(finalName) + 1;
                nameMap.set(finalName, count);
                const parts = finalName.split('.');
                if (parts.length > 1) {
                    const ext = parts.pop();
                    finalName = `${parts.join('.')}_(${count}).${ext}`;
                } else {
                    finalName = `${finalName}_(${count})`;
                }
            } else {
                nameMap.set(finalName, 0);
            }

            folder.file(finalName, blob);
            downloadedCount++;
        } catch (e) {
            console.warn(`Skip image in ZIP: ${img.url}`);
        }
    }

    if (downloadedCount === 0) {
        showToast('Gagal mengunduh gambar untuk ZIP.', 'error');
        zipBtn.disabled = false;
        zipBtnText.innerHTML = `<i data-lucide="archive"></i> Download Semua (ZIP)`;
        zipBtnSpinner.classList.add('hidden');
        lucide.createIcons();
        return;
    }

    zipBtnText.innerHTML = `<i data-lucide="loader" class="spin"></i> Zipping...`;

    try {
        const content = await zip.generateAsync({ type: "blob" });
        const safeTitle = activeScrapedData.metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
        
        triggerFileDownload(content, `${safeTitle || 'scraped'}_images.zip`, "application/zip");
        showToast(`ZIP Berhasil diunduh! (${downloadedCount}/${totalCount} gambar)`, 'success');
    } catch (e) {
        showToast('Zipping gagal: ' + e.message, 'error');
    } finally {
        zipBtn.disabled = false;
        zipBtnText.innerHTML = `<i data-lucide="archive"></i> Download Semua (ZIP)`;
        zipBtnSpinner.classList.add('hidden');
        lucide.createIcons();
    }
}

// ==========================================================================
// HISTORY MANAGER
// ==========================================================================
const HISTORY_KEY = 'scrapeflow-history-list';

function saveToHistory(url, title) {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (e) {}

    history = history.filter(item => item.url.toLowerCase() !== url.toLowerCase());

    history.unshift({
        url,
        title: title || 'Untitled Article',
        timestamp: Date.now()
    });

    if (history.length > 20) {
        history.pop();
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    loadHistory();
}

function loadHistory() {
    const listContainer = document.getElementById('history-list');
    listContainer.innerHTML = '';

    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (e) {}

    if (history.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-history">
                <i data-lucide="history"></i>
                <p>Belum ada riwayat</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-info" title="Klik untuk scrape ulang">
                <div class="history-title">${item.title}</div>
                <div class="history-url">${item.url}</div>
            </div>
            <button class="history-delete" title="Hapus" data-url="${item.url}">
                <i data-lucide="x"></i>
            </button>
        `;

        historyItem.querySelector('.history-info').addEventListener('click', () => {
            document.getElementById('url-input').value = item.url;
            performScrape(item.url);
        });

        historyItem.querySelector('.history-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteHistoryItem(item.url);
        });

        listContainer.appendChild(historyItem);
    });

    lucide.createIcons();
}

function deleteHistoryItem(url) {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (e) {}

    history = history.filter(item => item.url.toLowerCase() !== url.toLowerCase());
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    loadHistory();
    showToast('Item riwayat dihapus.', 'info');
}

function clearAllHistory() {
    if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat?')) {
        localStorage.removeItem(HISTORY_KEY);
        loadHistory();
        showToast('Riwayat dibersihkan.', 'success');
    }
}
