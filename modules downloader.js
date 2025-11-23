// ==UserScript==
// @name        OFPPT Scribd Downloader - Enhanced with Auto-Search
// @namespace   Violentmonkey Scripts
// @match       *://*.scribd.com/*
// @match       *://*.docplayer.fr/*
// @match       *://*.pdfcoffee.com/*
// @match       *://*.academia.edu/*
// @match       *://*.researchgate.net/*
// @match       *://*.google.com/search*
// @match       *://*.bing.com/search*
// @match       *://*.duckduckgo.com/*
// @grant       GM_xmlhttpRequest
// @grant       GM_download
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_notification
// @grant       GM_openInTab
// @connect     scribd.downloader.tips
// @connect     scribd.vdownloaders.com
// @connect     ofppt.ma
// @connect     cours.ofppt.info
// @connect     google.com
// @connect     bing.com
// @version     3.0
// @author      OFPPT Assistant
// @description Enhanced downloader for OFPPT materials with auto-search from modules.txt
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const config = {
        ofpptKeywords: ['OFPPT', 'technicien', 'spécialisé', 'module', 'cours', 'formation', 'M101', 'M102', 'M103', 'EGTS'],
        autoDetectOFPPT: true,
        saveToFolder: 'OFPPT_Modules',
        retryCount: 3,
        timeout: 30000,
        modulesFileUrl: 'https://raw.githubusercontent.com/your-username/your-repo/main/modules.txt', // Change this to your actual URL
        searchDelay: 2000, // Delay between searches to avoid being blocked
        maxConcurrentSearches: 3
    };

    // Store module information and search state
    let currentModuleInfo = {
        name: '',
        code: '',
        type: 'unknown',
        originalUrl: ''
    };

    let allModules = [];
    let searchQueue = [];
    let activeSearches = 0;
    let completedSearches = 0;

    // Initialize
    function init() {
        console.log('OFPPT Downloader with Auto-Search initialized');
        loadModulesList();
        detectOFPPTContent();
        createEnhancedUI();
        setupAutoSave();
    }

    // Load modules from external file or local storage
    async function loadModulesList() {
        try {
            // Try to load from localStorage first
            const savedModules = GM_getValue('ofppt_modules', null);
            if (savedModules) {
                allModules = savedModules;
                console.log(`Loaded ${allModules.length} modules from storage`);
                return;
            }

            // If no saved modules, try to load from file
            if (config.modulesFileUrl) {
                const modulesText = await fetchModulesFile();
                allModules = parseModulesFile(modulesText);
                GM_setValue('ofppt_modules', allModules);
                console.log(`Loaded ${allModules.length} modules from file`);
            } else {
                // Fallback: use hardcoded modules from the file content you provided
                allModules = getDefaultModules();
                GM_setValue('ofppt_modules', allModules);
                console.log(`Loaded ${allModules.length} default modules`);
            }
        } catch (error) {
            console.error('Error loading modules:', error);
            showNotification('Error loading modules list', 'error');
        }
    }

    // Fetch modules from external file
    function fetchModulesFile() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: config.modulesFileUrl,
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                },
                timeout: config.timeout
            });
        });
    }

    // Parse modules from text file
    function parseModulesFile(content) {
        const modules = [];
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            // Extract module code and name
            const moduleMatch = trimmed.match(/^([A-Z]+\d+)\s+(.+)$/);
            if (moduleMatch) {
                const [, code, name] = moduleMatch;
                modules.push({
                    code: code.trim(),
                    name: name.trim(),
                    searchQueries: generateSearchQueries(code.trim(), name.trim()),
                    downloaded: false,
                    lastSearched: null
                });
            } else if (trimmed.length > 3) {
                // Fallback for lines without codes
                modules.push({
                    code: '',
                    name: trimmed,
                    searchQueries: generateSearchQueries('', trimmed),
                    downloaded: false,
                    lastSearched: null
                });
            }
        }

        return modules;
    }

    // Get default modules (from your provided file content)
    function getDefaultModules() {
        const defaultModules = [
            "M101 Métier et formation", "M102 Entreprise et son environnement", "M103 Marketing",
            "M104 Statistiques", "M105 Comptabilité générale", "M106 Législation sociale",
            "M107 Management des organisations", "M108 Gestion des ressources humaines",
            "M109 Outils informatiques de gestion", "EGTS1 Arabe", "EGTS2 Communication écrite et orale",
            "EGTS3 Anglais technique", "EGTS4 Culture entrepreneuriale", "M201 Comptabilité des sociétés",
            "M202 Fiscalité des entreprises TVA IS IR", "M203 Gestion de la paie", "M204 Diagnostic financier",
            "M205 Travaux de fin d'exercice", "M206 Comptabilité analytique", "M207 Contrôle de gestion",
            "M208 Gestion financière", "M209 Logiciels de gestion intégrée", "EGTS5 Communication en langue anglaise",
            "EGTS6 Communication en langue française", "M210 Projet de fin de formation PFE"
            // Add more modules as needed from your file
        ];

        return defaultModules.map(module => {
            const moduleMatch = module.match(/^([A-Z]+\d+)\s+(.+)$/);
            if (moduleMatch) {
                const [, code, name] = moduleMatch;
                return {
                    code: code,
                    name: name,
                    searchQueries: generateSearchQueries(code, name),
                    downloaded: false,
                    lastSearched: null
                };
            }
            return {
                code: '',
                name: module,
                searchQueries: generateSearchQueries('', module),
                downloaded: false,
                lastSearched: null
            };
        });
    }

    // Generate search queries for a module
    function generateSearchQueries(code, name) {
        const baseQueries = [
            `${code} ${name} OFPPT`,
            `${name} OFPPT cours`,
            `OFPPT ${code} ${name} pdf`,
            `${code} ${name} cours pdf`,
            `${name} module OFPPT`,
            `${code} ${name} exercices corrigés`,
            `${name} résumé OFPPT`
        ].filter(query => query.trim().length > 5);

        // Add code-only queries if code exists
        if (code) {
            baseQueries.push(`${code} OFPPT`, `OFPPT ${code} pdf`);
        }

        return baseQueries;
    }

    // Auto-search functionality
    function startAutoSearch() {
        if (allModules.length === 0) {
            showNotification('No modules loaded. Please check your modules file.', 'error');
            return;
        }

        const undownloadedModules = allModules.filter(module => !module.downloaded);
        if (undownloadedModules.length === 0) {
            showNotification('All modules have been downloaded!', 'success');
            return;
        }

        showNotification(`Starting auto-search for ${undownloadedModules.length} modules`, 'info');
        searchQueue = [...undownloadedModules];
        activeSearches = 0;
        completedSearches = 0;

        processSearchQueue();
    }

    function processSearchQueue() {
        while (searchQueue.length > 0 && activeSearches < config.maxConcurrentSearches) {
            const module = searchQueue.shift();
            activeSearches++;
            searchForModule(module);
        }

        if (searchQueue.length === 0 && activeSearches === 0) {
            showNotification(`Auto-search completed! Processed ${completedSearches} modules`, 'success');
            updateSearchProgress();
        }
    }

    function searchForModule(module) {
        console.log(`Searching for: ${module.code} ${module.name}`);
        updateSearchProgress();

        // Use the first search query
        const query = module.searchQueries[0];
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

        GM_openInTab(searchUrl, {
            active: false,
            setParent: true,
            onload: function(tab) {
                setTimeout(() => {
                    // In a real implementation, you'd parse the search results here
                    // and automatically navigate to promising Scribd links
                    console.log(`Search completed for: ${module.name}`);

                    // For now, we'll just mark it as searched and continue
                    module.lastSearched = new Date().toISOString();
                    activeSearches--;
                    completedSearches++;

                    // Save progress
                    GM_setValue('ofppt_modules', allModules);

                    // Continue with next module after delay
                    setTimeout(processSearchQueue, config.searchDelay);
                }, 2000);
            }
        });
    }

    function updateSearchProgress() {
        const progressElement = document.getElementById('search-progress');
        if (progressElement) {
            const total = allModules.length;
            const downloaded = allModules.filter(m => m.downloaded).length;
            const inQueue = searchQueue.length;
            progressElement.textContent = `Progress: ${downloaded}/${total} | Queue: ${inQueue} | Active: ${activeSearches}`;
        }
    }

    // Enhanced download functions (from previous version)
    function downloadContent(format = 'txt') {
        try {
            let content = '';
            let filename = '';

            switch (format) {
                case 'txt':
                    content = extractTextContent();
                    filename = generateFilename('txt');
                    downloadText(content, filename);
                    break;
                case 'pdf':
                    downloadContentAsPDF();
                    break;
                case 'images':
                    downloadAsImages();
                    break;
                default:
                    console.error('Unsupported format:', format);
            }
        } catch (error) {
            console.error('Download error:', error);
            showNotification(`Download failed: ${error.message}`, 'error');
        }
    }

    function extractTextContent() {
        let content = '';
        const selectors = [
            '.text_layer .a',
            '.page .text',
            '.document_page p',
            '.reader_content',
            '#document_container',
            '[class*="text"]',
            '.bloom-page'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                elements.forEach(element => {
                    content += element.textContent + '\n';
                });
                break;
            }
        }

        if (!content.trim()) {
            content = document.body.innerText;
        }

        const header = generateFileHeader();
        return header + '\n\n' + cleanTextContent(content);
    }

    function generateFilename(extension) {
        const baseName = currentModuleInfo.code
            ? `${currentModuleInfo.code}_${currentModuleInfo.name}`
            : currentModuleInfo.name || 'scribd_content';

        return `${config.saveToFolder}/${baseName}.${extension}`
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 100);
    }

    function generateFileHeader() {
        return `OFPPT Module Document
Module: ${currentModuleInfo.code || 'N/A'} - ${currentModuleInfo.name}
Type: ${currentModuleInfo.type}
Source: ${currentModuleInfo.originalUrl}
Downloaded: ${new Date().toLocaleString()}
---
`;
    }

    async function downloadContentAsPDF(service = 'primary') {
        let savedUrl = localStorage.getItem('originalUrl') || window.location.href;

        const services = {
            primary: 'https://scribd.downloader.tips',
            secondary: 'https://scribd.vdownloaders.com'
        };

        const selectedService = services[service] || services.primary;

        try {
            const pdfUrl = await generatePDFUrl(savedUrl, selectedService);
            if (pdfUrl) {
                const filename = generateFilename('pdf');
                GM_download({
                    url: pdfUrl,
                    name: filename,
                    onload: () => {
                        showNotification('PDF downloaded successfully!', 'success');
                        markModuleAsDownloaded();
                    },
                    onerror: (error) => {
                        console.error('Download failed:', error);
                        fallbackPDFDownload(pdfUrl, filename);
                    }
                });
            }
        } catch (error) {
            console.error('PDF generation failed:', error);
            showNotification(`PDF service ${service} failed. Trying alternative...`, 'warning');

            const nextService = service === 'primary' ? 'secondary' : 'primary';
            setTimeout(() => downloadContentAsPDF(nextService), 2000);
        }
    }

    function markModuleAsDownloaded() {
        const currentModule = allModules.find(module =>
            module.code === currentModuleInfo.code ||
            module.name.includes(currentModuleInfo.name)
        );

        if (currentModule) {
            currentModule.downloaded = true;
            currentModule.downloadedAt = new Date().toISOString();
            GM_setValue('ofppt_modules', allModules);
            updateSearchProgress();
        }
    }

    // Enhanced UI with auto-search controls
    function createEnhancedUI() {
        const container = document.createElement('div');
        container.id = 'ofppt-downloader-ui';
        Object.assign(container.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: 10000,
            background: '#2c3e50',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif',
            minWidth: '250px',
            color: 'white'
        });

        // Header
        const header = document.createElement('div');
        header.innerHTML = '<h3 style="margin: 0 0 10px 0; text-align: center;">📚 OFPPT Downloader</h3>';
        container.appendChild(header);

        // Search Progress
        const progressDiv = document.createElement('div');
        progressDiv.id = 'search-progress';
        progressDiv.style.cssText = 'font-size: 12px; margin-bottom: 10px; text-align: center; background: #34495e; padding: 5px; border-radius: 4px;';
        progressDiv.textContent = 'Loading modules...';
        container.appendChild(progressDiv);

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '8px';

        // Auto-search buttons
        const autoSearchButton = createButton('🚀 Start Auto-Search', '#e67e22', startAutoSearch);
        const reloadModulesButton = createButton('🔄 Reload Modules', '#3498db', reloadModules);

        // Download buttons
        const downloadButtons = [
            { label: '📄 Download TXT', color: '#2ecc71', action: () => downloadContent('txt') },
            { label: '📊 Download PDF', color: '#e74c3c', action: () => downloadContentAsPDF('primary') },
            { label: '🖼️ Download Images', color: '#9b59b6', action: () => downloadContent('images') },
            { label: '⚙️ Settings', color: '#95a5a6', action: showSettings }
        ];

        buttonContainer.appendChild(autoSearchButton);
        buttonContainer.appendChild(reloadModulesButton);

        downloadButtons.forEach(btn => {
            buttonContainer.appendChild(createButton(btn.label, btn.color, btn.action));
        });

        container.appendChild(buttonContainer);
        document.body.appendChild(container);

        // Add drag functionality
        makeDraggable(container);

        // Initial progress update
        setTimeout(updateSearchProgress, 1000);
    }

    function createButton(label, color, action) {
        const button = document.createElement('button');
        button.textContent = label;
        button.style.cssText = `
            padding: 8px 12px;
            background: ${color};
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.3s;
        `;
        button.onmouseover = () => button.style.background = darkenColor(color, 20);
        button.onmouseout = () => button.style.background = color;
        button.onclick = action;
        return button;
    }

    function reloadModules() {
        GM_setValue('ofppt_modules', null);
        loadModulesList().then(() => {
            showNotification('Modules reloaded successfully!', 'success');
            updateSearchProgress();
        });
    }

    // Helper functions (from previous version)
    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        element.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    function darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    function showNotification(message, type = 'info') {
        const colors = {
            info: '#3498db',
            success: '#2ecc71',
            warning: '#f39c12',
            error: '#e74c3c'
        };

        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                text: message,
                title: 'OFPPT Downloader',
                highlight: true
            });
        } else {
            const notification = document.createElement('div');
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: ${colors[type] || colors.info};
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                z-index: 10001;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }
    }

    function showSettings() {
        showNotification('Settings panel - Coming soon!', 'info');
    }

    function setupAutoSave() {
        const currentUrl = window.location.href;
        if (currentUrl.includes("scribd.com/document") ||
            currentUrl.includes("scribd.com/doc") ||
            currentUrl.includes("scribd.com/presentation")) {
            localStorage.setItem('originalUrl', currentUrl);
        }
    }

    function detectOFPPTContent() {
        if (!config.autoDetectOFPPT) return;
        const pageText = document.body.innerText.toLowerCase();
        const ofpptIndicators = config.ofpptKeywords.map(kw => kw.toLowerCase());
        const foundKeywords = ofpptIndicators.filter(keyword => pageText.includes(keyword));
        if (foundKeywords.length > 0) {
            extractModuleInfo();
            showNotification(`OFPPT content detected: ${foundKeywords.join(', ')}`, 'success');
        }
    }

    function extractModuleInfo() {
        const title = document.title;
        const bodyText = document.body.innerText;
        const moduleCodeMatch = title.match(/\b[MEGT]\d{3}\b/) || bodyText.match(/\b[MEGT]\d{3}\b/);
        if (moduleCodeMatch) {
            currentModuleInfo.code = moduleCodeMatch[0];
        }
        currentModuleInfo.name = title.replace(/Scribd|PDF|document|\(.*\)/gi, '').trim();
        currentModuleInfo.originalUrl = window.location.href;
        currentModuleInfo.type = determineModuleType();
    }

    function determineModuleType() {
        const text = document.body.innerText.toLowerCase();
        if (text.includes('comptabilité') || text.includes('finance')) return 'finance';
        if (text.includes('marketing') || text.includes('commerce')) return 'commerce';
        if (text.includes('informatique') || text.includes('programmation')) return 'informatique';
        if (text.includes('gestion') || text.includes('management')) return 'gestion';
        if (text.includes('technique') || text.includes('génie')) return 'technique';
        return 'général';
    }

    function cleanTextContent(text) {
        return text
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .replace(/[^\S\n]+/g, ' ')
            .trim();
    }

    async function generatePDFUrl(documentUrl, serviceBase) {
        const regex = /https?:\/\/(?:.*\.)?scribd\.com\/([^/]+)\/(\d+)\/([^/?#]+)/;
        const match = documentUrl.match(regex);
        if (match) {
            const [_, type, id, title] = match;
            return `${serviceBase}/${type}/${id}/${title}`;
        } else {
            const docId = extractDocumentId(documentUrl);
            if (docId) {
                return `${serviceBase}/document/${docId}`;
            }
        }
        throw new Error('Could not generate PDF URL');
    }

    function extractDocumentId(url) {
        const patterns = [
            /\/document\/(\d+)/,
            /\/doc\/(\d+)/,
            /\/presentation\/(\d+)/,
            /\/embeds\/(\d+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    function fallbackPDFDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function downloadAsImages() {
        const images = document.querySelectorAll('img[src*="scribd"], .page img, .document_image');
        if (images.length === 0) {
            showNotification('No images found to download', 'error');
            return;
        }
        showNotification(`Found ${images.length} images. Starting download...`, 'info');
        images.forEach((img, index) => {
            setTimeout(() => {
                const filename = generateFilename(`page_${String(index + 1).padStart(3, '0')}.jpg`);
                GM_download({
                    url: img.src,
                    name: filename
                });
            }, index * 1000);
        });
    }

    function downloadText(content, filename) {
        const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('Text file downloaded successfully!', 'success');
    }

    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
