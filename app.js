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
                                <div class="mx-meta">TTL: ${record.ttl || 'N/A'}</div>
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
            // Send exactly ONE request for all domains to the backend
            const response = await fetch('/api/bulk-mx', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ domains: uniqueDomains })
            });

            if (!response.ok) {
                throw new Error('Server error: ' + response.statusText);
            }

            const data = await response.json();
            
            renderBulkRecords(data.results);
            showState('results');
        } catch (error) {
            errorMessage.textContent = error.message || 'A critical error occurred while fetching records.';
            showState('error');
        } finally {
            submitBtn.disabled = false;
        }
    });
});
