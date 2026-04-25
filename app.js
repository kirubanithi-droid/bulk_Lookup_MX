// Initialize Lucide icons
lucide.createIcons();

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('lookup-form');
    const input = document.getElementById('domain-input');
    const submitBtn = document.getElementById('search-btn');
    const resultsContainer = document.getElementById('results-container');
    const resultCount = document.getElementById('result-count');
    
    // States
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const emptyState = document.getElementById('empty-state');
    const bulkResults = document.getElementById('bulk-results');

    // Utility to show specific state
    function showState(state) {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        emptyState.classList.add('hidden');
        bulkResults.classList.add('hidden');
        
        resultsContainer.classList.remove('hidden');

        if (state === 'loading') {
            loadingState.classList.remove('hidden');
        } else if (state === 'error') {
            errorState.classList.remove('hidden');
        } else if (state === 'empty') {
            emptyState.classList.remove('hidden');
        } else if (state === 'results') {
            bulkResults.classList.remove('hidden');
        }
    }

    function cleanDomain(domain) {
        return domain.replace(/^(https?:\/\/)?(www\.)?/, '')
                     .split('/')[0]
                     .trim()
                     .toLowerCase();
    }

    async function fetchMXRecords(domain) {
        const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=15`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.json();
            
            if (data.Status !== 0) {
                const errorMsg = data.Status === 3 ? 'Domain does not exist.' : `DNS Error (Code: ${data.Status})`;
                throw new Error(errorMsg);
            }

            if (!data.Answer || data.Answer.length === 0) {
                return [];
            }

            const records = data.Answer
                .filter(ans => ans.type === 15)
                .map(ans => {
                    const parts = ans.data.split(' ');
                    return {
                        priority: parseInt(parts[0], 10),
                        target: parts[1] ? parts[1].replace(/\.$/, '') : ans.data,
                        ttl: ans.TTL
                    };
                })
                .sort((a, b) => a.priority - b.priority);

            return records;

        } catch (error) {
            console.error(`Error fetching MX records for ${domain}:`, error);
            throw error;
        }
    }

    function renderBulkRecords(results) {
        bulkResults.innerHTML = '';
        
        results.forEach((result, index) => {
            const group = document.createElement('div');
            group.className = 'domain-group';
            group.style.animationDelay = `${index * 0.1}s`;
            
            // Header
            let statusHtml = '';
            if (result.error) {
                statusHtml = `<span class="domain-group-status status-error">Error</span>`;
            } else if (result.records.length === 0) {
                statusHtml = `<span class="domain-group-status status-error">No MX Records</span>`;
            } else {
                statusHtml = `<span class="domain-group-status status-success">${result.records.length} Record${result.records.length !== 1 ? 's' : ''}</span>`;
            }

            let html = `
                <div class="domain-group-header">
                    <i data-lucide="globe"></i>
                    <h3>${result.domain}</h3>
                    ${statusHtml}
                </div>
            `;

            // Error or Records list
            if (result.error) {
                html += `<div style="color: var(--error); font-size: 0.875rem;">${result.error}</div>`;
            } else if (result.records.length > 0) {
                html += `<ul class="mx-list">`;
                result.records.forEach(record => {
                    html += `
                        <li class="mx-item" style="opacity: 1; transform: none; animation: none;">
                            <div class="mx-priority">
                                ${record.priority}
                                <span>Pri</span>
                            </div>
                            <div class="mx-details">
                                <div class="mx-target" title="${record.target}">${record.target}</div>
                                <div class="mx-meta">TTL: ${record.ttl}s</div>
                            </div>
                            <button class="mx-copy" aria-label="Copy to clipboard" data-target="${record.target}">
                                <i data-lucide="copy"></i>
                            </button>
                        </li>
                    `;
                });
                html += `</ul>`;
            }

            group.innerHTML = html;
            bulkResults.appendChild(group);
        });
        
        lucide.createIcons({
            root: bulkResults
        });

        const copyBtns = bulkResults.querySelectorAll('.mx-copy');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                navigator.clipboard.writeText(target).then(() => {
                    e.currentTarget.innerHTML = `<i data-lucide="check" style="color: var(--success)"></i>`;
                    lucide.createIcons({ root: e.currentTarget });
                    
                    setTimeout(() => {
                        e.currentTarget.innerHTML = `<i data-lucide="copy"></i>`;
                        lucide.createIcons({ root: e.currentTarget });
                    }, 2000);
                });
            });
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawInput = input.value;
        if (!rawInput) return;

        // Split by comma or newline, clean, and remove empty
        const domains = rawInput.split(/[\n,]+/)
                                .map(cleanDomain)
                                .filter(d => d.length > 0);
        
        if (domains.length === 0) {
            showState('empty');
            return;
        }
        
        // Remove duplicates
        const uniqueDomains = [...new Set(domains)];
        
        // Update UI
        input.blur();
        submitBtn.disabled = true;
        resultCount.textContent = `(${uniqueDomains.length} domains)`;
        showState('loading');

        try {
            // Fetch all concurrently from the client side (Works on GitHub Pages)
            const results = await Promise.all(uniqueDomains.map(async (domain) => {
                try {
                    const records = await fetchMXRecords(domain);
                    return { domain, records, error: null };
                } catch (error) {
                    return { domain, records: [], error: error.message };
                }
            }));
            
            renderBulkRecords(results);
            showState('results');
        } catch (error) {
            errorMessage.textContent = 'A critical error occurred while fetching records.';
            showState('error');
        } finally {
            submitBtn.disabled = false;
        }
    });
});
