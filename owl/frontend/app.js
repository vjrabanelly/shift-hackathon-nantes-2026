document.addEventListener('DOMContentLoaded', () => {
    const pdfInput = document.getElementById('pdf-input');
    const dropZone = document.getElementById('drop-zone');
    const generateBtn = document.getElementById('generate-btn');
    const fileInfo = document.getElementById('file-info');
    const fileNameDisplay = fileInfo.querySelector('.file-name');
    const removeFileBtn = document.getElementById('remove-file');

    const loadingState = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    const emptyState = document.getElementById('empty-state');
    const fileStatusHeader = document.getElementById('file-status-header');
    const featureTitle = document.getElementById('feature-title');

    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const chatHistory = document.getElementById('chat-history');

    const BACKEND_URL = 'http://localhost:8001';

    let selectedFiles = [];
    let currentFeature = 'podcast';
    let contextId = null;

    const features = {
        podcast: { title: "Podcast <span>Duo</span>", endpoint: "/generate-podcast" },
        summary: { title: "Résumé <span>de cours</span>", endpoint: "/rag/query", mode: "summarize" },
        exercises: { title: "QCM <span>interactifs</span>", endpoint: "/rag/query", mode: "exercises" },
        chat: { title: "Chat <span>Cours</span>", endpoint: "/rag/query", mode: "chat" }
    };

    const loadingMessages = {
        podcast: "Génération du podcast Owl & Billie...",
        summary: "Rédaction du résumé...",
        exercises: "Création des QCM...",
        chat: "Recherche dans le cours..."
    };

    // Sidebar Navigation
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', () => {
            document.querySelectorAll('.nav-links li').forEach(item => item.classList.remove('active'));
            li.classList.add('active');
            currentFeature = li.dataset.feature;
            featureTitle.innerHTML = features[currentFeature].title;

            document.querySelectorAll('.feature-config').forEach(c => c.classList.add('hidden'));
            const specificConfig = document.getElementById(`config-${currentFeature}`);
            if (specificConfig) specificConfig.classList.remove('hidden');

            resetResultView();
        });
    });

    // File Handling
    dropZone.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', (e) => handleFiles(e.target.files));
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent-primary)'; });
    dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = 'var(--glass-border)');
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); });

    function handleFiles(files) {
        if (!files || files.length === 0) return;

        const allowedExtensions = ['.pdf', '.pptx', '.docx', '.doc', '.txt'];
        const newFiles = Array.from(files).filter(f => {
            const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
            return allowedExtensions.includes(ext);
        });

        if (newFiles.length === 0) return alert('Formats supportés : PDF, PPTX, DOCX, TXT');

        selectedFiles = newFiles;
        const count = selectedFiles.length;
        const label = count > 1 ? `${count} fichiers sélectionnés` : selectedFiles[0].name;

        fileNameDisplay.textContent = label;
        fileStatusHeader.textContent = `Source : ${label}`;
        fileInfo.classList.remove('hidden');
        dropZone.classList.add('hidden');
        generateBtn.disabled = false;
        if (!contextId) contextId = 'ctx_' + Math.random().toString(36).substring(2, 10);
    }

    removeFileBtn.addEventListener('click', () => {
        selectedFiles = []; fileInfo.classList.add('hidden'); dropZone.classList.remove('hidden');
        generateBtn.disabled = true; pdfInput.value = ''; fileStatusHeader.textContent = "Aucun fichier sélectionné";
    });

    // Generation Core
    generateBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        resetResultView();
        generateBtn.disabled = true;
        emptyState.classList.add('hidden');
        loadingState.classList.remove('hidden');
        loadingText.textContent = "Ingestion du PDF...";

        try {
            // 1. Ingest all files (RAG)
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                loadingText.textContent = `Analyse du fichier ${i + 1}/${selectedFiles.length}...`;

                const formData = new FormData();
                formData.append('file', file);
                formData.append('context_id', contextId);

                const ingestRes = await fetch(`${BACKEND_URL}/rag/ingest`, { method: 'POST', body: formData });
                if (!ingestRes.ok) throw new Error(`Échec de l'ingestion de ${file.name}`);
            }

            // 2. Feature specific
            loadingText.textContent = loadingMessages[currentFeature] || "Génération en cours...";

            if (currentFeature === 'podcast') {
                await handlePodcastGeneration();
            } else if (currentFeature === 'exercises') {
                await handleExercisesGeneration();
            } else {
                await handleRAGStreaming(currentFeature);
            }
        } catch (err) {
            alert(err.message);
            emptyState.classList.remove('hidden');
        } finally {
            loadingState.classList.add('hidden');
            generateBtn.disabled = false;
        }
    });

    async function handlePodcastGeneration() {
        loadingText.textContent = "Extraction du contenu...";
        let fullText = "";

        for (const file of selectedFiles) {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch(`${BACKEND_URL}/upload-pdf`, { method: 'POST', body: fd });
            if (!res.ok) continue;
            const { text } = await res.json();
            fullText += text + "\n\n";
        }

        if (!fullText.trim()) throw new Error("Aucun texte n'a pu être extrait des fichiers.");

        const genBody = new FormData();
        genBody.append('text', fullText);
        genBody.append('mode', 'duo');
        genBody.append('provider', 'elevenlabs');

        const podRes = await fetch(`${BACKEND_URL}/generate-podcast`, { method: 'POST', body: genBody });
        const podData = await podRes.json();
        const finalData = await pollJobStatus(podData.job_id);
        renderOutput('podcast', finalData);
    }

    async function handleExercisesGeneration() {
        loadingText.textContent = "Extraction du contenu...";
        let fullText = "";

        for (const file of selectedFiles) {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch(`${BACKEND_URL}/upload-pdf`, { method: 'POST', body: fd });
            if (!res.ok) continue;
            const { text } = await res.json();
            fullText += text + "\n\n";
        }

        if (!fullText.trim()) throw new Error("Aucun texte n'a pu être extrait des fichiers.");

        loadingText.textContent = "Création des QCM...";

        const genBody = new FormData();
        genBody.append('text', fullText);

        const exRes = await fetch(`${BACKEND_URL}/generate-exercises`, { method: 'POST', body: genBody });
        if (!exRes.ok) throw new Error("La génération des QCM a échoué");
        const data = await exRes.json();

        // Affichage
        const outlet = document.getElementById('result-exercises');
        const contentArea = document.getElementById('exercises-content');
        document.querySelectorAll('.result-outlet').forEach(o => o.classList.add('hidden'));
        outlet.classList.remove('hidden');

        // Déballer : data peut être {questions:[]} ou {exercises:{questions:[]}}
        const questions = data.questions || (data.exercises && data.exercises.questions);
        if (questions && Array.isArray(questions)) {
            contentArea.innerHTML = renderQCM(questions);
            triggerMathRendering('exercises-content');
        } else {
            contentArea.innerHTML = '<p>Format QCM inattendu.</p>';
        }
    }

    function renderQCM(questions) {
        return questions.map((q, i) => {
            const options = Array.isArray(q.options)
                ? q.options
                : Object.entries(q.options).map(([k, v]) => ({ key: k, text: v }));

            return `
            <div class="qcm-card" data-idx="${i}">
                <div class="qcm-question">
                    <span class="qcm-num">${i + 1}.</span>
                    <span>${q.question}</span>
                </div>
                <div class="qcm-options">
                    ${options.map(opt => {
                const key = opt.key || opt.charAt?.(0) || '';
                const text = opt.text || opt.substring?.(3) || opt;
                return `
                        <div class="qcm-option" data-key="${key}" data-answer="${q.answer}" data-idx="${i}">
                            <strong>${key}.</strong>
                            <span>${text}</span>
                        </div>`;
            }).join('')}
                </div>
                <div class="qcm-explanation" id="qcm-expl-${i}">
                    💡 ${q.explanation}
                </div>
            </div>`;
        }).join('');
    }

    // Event delegation for QCM clicks
    document.addEventListener('click', (e) => {
        const option = e.target.closest('.qcm-option');
        if (!option) return;

        const card = option.closest('.qcm-card');
        if (card.dataset.answered) return;
        card.dataset.answered = 'true';

        const selected = option.dataset.key;
        const correct = option.dataset.answer;
        const idx = option.dataset.idx;

        card.querySelectorAll('.qcm-option').forEach(opt => {
            const k = opt.dataset.key;
            if (k === correct) {
                opt.style.borderColor = '#23d160';
                opt.style.background = 'rgba(35,209,96,0.15)';
            } else if (k === selected && selected !== correct) {
                opt.style.borderColor = '#ef4444';
                opt.style.background = 'rgba(239,68,68,0.15)';
            }
        });

        document.getElementById(`qcm-expl-${idx}`).style.display = 'block';
    });

    // Event delegation for accordion clicks (summary nav + headers)
    document.addEventListener('click', (e) => {
        const navLink = e.target.closest('.summary-nav-link');
        const header = e.target.closest('.accordion-header');
        const target = navLink || header;
        if (!target) return;

        e.preventDefault();
        const idx = target.dataset.section;
        if (idx === undefined) return;

        const body = document.getElementById(`body-${idx}`);
        const arrow = document.getElementById(`arrow-${idx}`);
        if (!body || !arrow) return;

        const isHidden = body.classList.contains('hidden');
        body.classList.toggle('hidden');
        arrow.textContent = isHidden ? '▼' : '▶';

        if (isHidden) {
            document.getElementById(`section-${idx}`).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            triggerMathRendering(`body-${idx}`);
        }
    });

    async function handleRAGStreaming(featureId) {
        const outlet = document.getElementById(`result-${featureId}`);
        const contentArea = featureId === 'chat' ? null : document.getElementById(`${featureId}-content`);

        outlet.classList.remove('hidden');
        if (contentArea) contentArea.innerHTML = '<div class="streaming-cursor"></div>';

        const body = new FormData();
        body.append('context_id', contextId);
        body.append('mode', features[featureId].mode);

        let query = "Résume le contenu du cours.";
        if (featureId === 'exercises') query = "Génère 5 QCM.";
        if (featureId === 'chat') query = chatInput.value || "Parle-moi de ce cours.";
        body.append('query', query);

        const response = await fetch(`${BACKEND_URL}/rag/query`, { method: 'POST', body: body });
        if (!response.ok) throw new Error('Échec du streaming');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        if (featureId === 'chat') appendChatBubble('ai', '');

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;

            if (featureId === 'chat') {
                updateLastChatBubble(fullText);
            } else {
                contentArea.innerHTML = formatMarkdown(fullText) + '<div class="streaming-cursor"></div>';
            }
        }

        if (contentArea) {
            if (featureId === 'summary') {
                contentArea.innerHTML = formatSummaryAccordion(fullText);
            } else {
                contentArea.innerHTML = formatMarkdown(fullText);
            }
            triggerMathRendering(`${featureId}-content`);
        } else if (featureId === 'chat') {
            updateLastChatBubble(fullText, false);
            triggerMathRendering('chat-history');
        }
    }

    // Chat
    sendChatBtn.addEventListener('click', async () => {
        const query = chatInput.value.trim();
        if (!query || !contextId) return;
        appendChatBubble('user', query);
        chatInput.value = '';
        await handleRAGStreaming('chat');
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatBtn.click();
    });

    function appendChatBubble(role, text) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role} ${role === 'ai' ? 'streaming-cursor' : ''}`;
        bubble.innerHTML = role === 'user' ? text : formatMarkdown(text);
        chatHistory.appendChild(bubble);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function updateLastChatBubble(text, isStreaming = true) {
        const bubbles = chatHistory.querySelectorAll('.chat-bubble.ai');
        const lastBubble = bubbles[bubbles.length - 1];
        if (lastBubble) {
            lastBubble.innerHTML = formatMarkdown(text);
            lastBubble.classList.toggle('streaming-cursor', isStreaming);
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    async function pollJobStatus(jobId) {
        while (true) {
            const res = await fetch(`${BACKEND_URL}/podcast/job/${jobId}`);
            const job = await res.json();
            if (job.status === 'completed') return job.result;
            if (job.status === 'failed') throw new Error(job.error || 'Échec de la génération');
            const labels = { pending: 'En attente...', processing: 'Génération en cours...' };
            loadingText.textContent = labels[job.status] || `Statut : ${job.status}...`;
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    function renderOutput(feature, data) {
        document.querySelectorAll('.result-outlet').forEach(o => o.classList.add('hidden'));
        const outlet = document.getElementById(`result-${feature}`);
        outlet.classList.remove('hidden');

        if (feature === 'podcast') {
            const player = document.getElementById('audio-player');
            player.src = `${BACKEND_URL}${data.audio_url}`;
            document.getElementById('download-link').href = player.src;
            document.getElementById('script-content').innerHTML = data.script.map(line => `
                <div class="script-line ${line.speaker}">
                    <span class="speaker">${line.speaker}</span>
                    <p>${line.content}</p>
                </div>
            `).join('');
            player.play();
        }
    }

    function resetResultView() {
        document.querySelectorAll('.result-outlet').forEach(o => o.classList.add('hidden'));
        emptyState.classList.remove('hidden');
        loadingState.classList.add('hidden');
        if (currentFeature === 'chat') {
            document.getElementById('result-chat').classList.remove('hidden');
            emptyState.classList.add('hidden');
        }
    }

    function formatSummaryAccordion(text) {
        if (typeof text !== 'string') return JSON.stringify(text);

        // Split by ## headings (sections)
        const lines = text.split('\n');
        let sections = [];
        let currentTitle = null;
        let currentContent = [];

        for (const line of lines) {
            const h2Match = line.match(/^##\s+(.+)/);
            if (h2Match) {
                if (currentTitle !== null) {
                    sections.push({ title: currentTitle, content: currentContent.join('\n') });
                }
                currentTitle = h2Match[1].trim();
                currentContent = [];
            } else if (currentTitle !== null) {
                currentContent.push(line);
            } else {
                // Content before first ## (intro)
                currentContent.push(line);
            }
        }
        // Push last section
        if (currentTitle !== null) {
            sections.push({ title: currentTitle, content: currentContent.join('\n') });
        }

        // If no ## found, fallback to simple markdown
        if (sections.length === 0) {
            return '<div class="markdown-view">' + marked.parse(text) + '</div>';
        }

        // Build intro (content before first ##)
        let introContent = '';
        const firstH2 = text.indexOf('\n## ');
        if (firstH2 > 0) {
            introContent = marked.parse(text.substring(0, firstH2).trim());
        }

        // Build accordion
        let html = '';
        if (introContent) html += `<div class="markdown-view" style="margin-bottom:16px">${introContent}</div>`;

        html += '<div class="summary-nav">';
        sections.forEach((s, i) => {
            html += `<span class="summary-nav-link" data-section="${i}">${s.title}</span>`;
        });
        html += '</div>';

        sections.forEach((s, i) => {
            const renderedContent = marked.parse(s.content.trim());
            html += `
                <div class="accordion-section" id="section-${i}">
                    <div class="accordion-header" data-section="${i}">
                        <span class="accordion-arrow" id="arrow-${i}">▼</span>
                        <span>${s.title}</span>
                    </div>
                    <div class="accordion-body" id="body-${i}">
                        <div class="markdown-view">${renderedContent}</div>
                    </div>
                </div>`;
        });

        return html;
    };

    function formatMarkdown(text) {
        if (typeof text !== 'string') return JSON.stringify(text);
        return marked.parse(text);
    }

    function triggerMathRendering(elementId) {
        const el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
        if (typeof renderMathInElement === 'function' && el) {
            renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            });
        }
    }
});
