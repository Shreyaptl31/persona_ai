(function () {
    'use strict';

    // ── DOM refs ──────────────────────────────
    const welcomeScreen = document.getElementById('welcome-screen');
    const chatScreen = document.getElementById('chat-screen');
    const messagesWrap = document.getElementById('messages');
    const welcomeInput = document.getElementById('welcome-input');
    const msgInput = document.getElementById('msg-input');
    const welcomeSendBtn = document.getElementById('welcome-send-btn');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatChips = document.getElementById('chat-chips');

    let chipsVisible = true;

    document.querySelector('.chat-header .name').addEventListener('click', () => {
        chatScreen.classList.add('hidden');
        welcomeScreen.classList.remove('hidden');
        welcomeInput.focus();
    });

    // ── Screen transition ─────────────────────
    function switchToChat() {
        welcomeScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        msgInput.focus();
    }

    function bindChips(containerEl) {
        containerEl.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const text = chip.dataset.text || chip.textContent.trim();
                if (!chatScreen.classList.contains('hidden') === false) {
                    switchToChat();
                }
                sendMessageText(text);
            });
        });
    }

    bindChips(document.getElementById('welcome-chips'));
    bindChips(chatChips);

    function startChat() {
        const text = welcomeInput.value.trim();
        if (!text) return;
        welcomeInput.value = '';
        switchToChat();
        sendMessageText(text);
    }

    welcomeSendBtn.addEventListener('click', startChat);
    welcomeInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') startChat();
    });

    function sendMessage() {
        const text = msgInput.value.trim();
        if (!text) return;
        msgInput.value = '';
        sendMessageText(text);
    }

    chatSendBtn.addEventListener('click', sendMessage);
    msgInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') sendMessage();
    });


    async function sendMessageText(text) {
        if (welcomeScreen.style.display !== 'none' &&
            !welcomeScreen.classList.contains('hidden')) {
            switchToChat();
        }

        appendMsg('user', text);
        hideChips();
        showTyping();
        scrollBottom();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();
            if (data.limit_reached) {
                hideTyping();
                appendMsg('ai', '⚠️ You\'ve reached the 5-message limit.');
                msgInput.disabled = true;
                chatSendBtn.disabled = true;
                msgInput.placeholder = '🚫 Message limit reached';
                scrollBottom();
                return;
            }

            // Parse persona JSON format: {"step":"result","content":"..."}
            let replyText = data.reply;
            try {
                const parsed = JSON.parse(replyText);
                if (parsed.content) replyText = parsed.content;
            } catch (e) { /* plain text, use as-is */ }

            hideTyping();
            appendMsg('ai', replyText || 'No response.');
        } catch (err) {
            hideTyping();
            appendMsg('ai', '⚠️ Connection error. Please try again.');
            console.error('Chat error:', err);
        }

        scrollBottom();
    }

    // ── Append message bubble ─────────────────
    function appendMsg(role, text) {
        const wrap = document.createElement('div');
        wrap.className = 'msg ' + role;

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';

        if (role === 'ai') {
            const avatarImg = document.createElement('img');
            avatarImg.src = '/static/user.png';
            avatarImg.alt = 'AI';
            avatarImg.style.cssText = 'width:100%; height:100%; border-radius:50%; object-fit:cover;';
            avatar.appendChild(avatarImg);
        } else {
            avatar.textContent = '👦';
        }

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerHTML = role === 'ai' ? renderMarkdown(text) : escapeHtml(text);

        wrap.appendChild(avatar);
        wrap.appendChild(bubble);
        messagesWrap.appendChild(wrap);
    }

    // ── Markdown renderer ─────────────────────
    function renderMarkdown(raw) {
        const blocks = [];
        let text = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
            const label = lang || 'code';
            const escaped = escapeHtml(code.trim());
            const idx = blocks.length;
            blocks.push(
                '<div class="code-block">' +
                '<div class="code-header">' +
                '<span class="code-lang">' + label + '</span>' +
                '<button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>' +
                '</div>' +
                '<pre><code>' + escaped + '</code></pre>' +
                '</div>'
            );
            return '\x00block' + idx + '\x00';
        });

        // Inline code
        text = text.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
        // Bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Newlines
        text = text.replace(/\n/g, '<br>');

        // Restore code blocks
        text = text.replace(/\x00block(\d+)\x00/g, (_, i) => blocks[i]);

        return text;
    }

    // ── Thinking steps ────────────────────────
    const thinkingSteps = [
        '🔍 Analysing your question...',
        '🧠 Thinking...',
        '⚙️ Processing...',
        '✅ Almost there...'
    ];

    // ── Typing indicator ──────────────────────
    function showTyping() {
        if (document.getElementById('typing')) return;
        const t = document.createElement('div');
        t.className = 'typing-indicator active';
        t.id = 'typing';
        t.innerHTML =
            '<div class="msg-avatar"><img src="/static/user.png" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/></div>' +
            '<div class="typing-bubble">' +
            '<div class="thinking-text" id="thinking-text">' + thinkingSteps[0] + '</div>' +
            '<div class="typing-dots"><span></span><span></span><span></span></div>' +
            '</div>';
        messagesWrap.appendChild(t);

        let i = 1;
        t._interval = setInterval(() => {
            const el = document.getElementById('thinking-text');
            if (el && i < thinkingSteps.length) {
                el.style.opacity = '0';
                setTimeout(() => {
                    if (el) {
                        el.textContent = thinkingSteps[i];
                        el.style.opacity = '1';
                        i++;
                    }
                }, 300);
            }
        }, 1200);
    }

    function hideTyping() {
        const t = document.getElementById('typing');
        if (t) {
            clearInterval(t._interval);
            t.remove();
        }
    }

    function hideChips() {
        if (chipsVisible) {
            chatChips.style.display = 'none';
            chipsVisible = false;
        }
    }

    function scrollBottom() {
        requestAnimationFrame(() => {
            messagesWrap.scrollTop = messagesWrap.scrollHeight;
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Copy button (global) ──────────────────
    window.copyCode = function (btn) {
        const code = btn.closest('.code-block').querySelector('code').innerText;
        navigator.clipboard.writeText(code).then(() => {
            btn.textContent = '✅ Copied!';
            setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
        });
    };

})();