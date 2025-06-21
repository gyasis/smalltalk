// SmallTalk Web Interface JavaScript

class SmallTalkWebApp {
    constructor() {
        this.socket = null;
        this.currentAgent = null;
        this.messageCount = 0;
        this.agentSwitches = 0;
        this.agents = [];
        
        this.initializeElements();
        this.initializeSocket();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }

    initializeElements() {
        // Core elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.currentAgentEl = document.getElementById('currentAgent');
        this.agentsListEl = document.getElementById('agentsList');
        
        // Stats elements
        this.messageCountEl = document.getElementById('messageCount');
        this.agentSwitchesEl = document.getElementById('agentSwitches');
        this.charCountEl = document.getElementById('charCount');
        this.typingIndicator = document.getElementById('typingIndicator');
        
        // Control elements
        this.clearChatBtn = document.getElementById('clearChat');
        this.exportChatBtn = document.getElementById('exportChat');
        this.importChatBtn = document.getElementById('importChat');
        this.helpBtn = document.getElementById('helpBtn');
        
        // Modal elements
        this.modalOverlay = document.getElementById('modalOverlay');
        this.closeModalBtn = document.getElementById('closeModal');
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus('connected', 'Connected');
            this.addSystemMessage('Connected to SmallTalk framework');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('disconnected', 'Disconnected');
            this.addSystemMessage('Disconnected from server');
        });

        this.socket.on('welcome', (data) => {
            this.addSystemMessage(data.message);
        });

        this.socket.on('message_received', (message) => {
            this.addMessage(message);
        });

        this.socket.on('message_response', (message) => {
            this.addMessage(message);
            this.typingIndicator.textContent = '';
        });

        this.socket.on('agents_updated', (data) => {
            this.updateAgentsList(data.agents);
        });

        this.socket.on('agent_switched', (data) => {
            this.updateCurrentAgent(data.agentName);
            this.agentSwitches++;
            this.updateStats();
            this.addSystemMessage(`Switched to agent: ${data.agentName}`);
        });

        this.socket.on('error', (error) => {
            this.addSystemMessage(`Error: ${error.message}`, 'error');
        });
    }

    setupEventListeners() {
        // Send message
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Message input
        this.messageInput.addEventListener('input', () => {
            this.updateCharCount();
            this.updateSendButton();
            this.autoResize();
        });

        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Control buttons
        this.clearChatBtn.addEventListener('click', () => this.clearChat());
        this.exportChatBtn.addEventListener('click', () => this.exportChat());
        this.importChatBtn.addEventListener('click', () => this.importChat());
        this.helpBtn.addEventListener('click', () => this.showHelp());

        // Modal
        this.closeModalBtn.addEventListener('click', () => this.hideModal());
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.hideModal();
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'k':
                        e.preventDefault();
                        this.clearChat();
                        break;
                    case '/':
                        e.preventDefault();
                        this.showHelp();
                        break;
                    case 'Enter':
                        if (e.target !== this.messageInput) {
                            e.preventDefault();
                            this.messageInput.focus();
                        }
                        break;
                }
            }
        });
    }

    updateConnectionStatus(status, text) {
        const statusDot = this.connectionStatus.querySelector('.status-dot');
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        statusDot.className = `status-dot ${status}`;
        statusText.textContent = text;
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Handle local commands
        if (message.startsWith('/')) {
            this.handleCommand(message);
            return;
        }

        // Send to server
        this.socket.emit('chat_message', {
            message,
            sessionId: 'web-session-' + Date.now()
        });

        this.messageInput.value = '';
        this.updateCharCount();
        this.updateSendButton();
        this.autoResize();
        this.typingIndicator.textContent = 'AI is typing...';
    }

    handleCommand(command) {
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();

        switch (cmd) {
            case '/clear':
                this.clearChat();
                break;
            case '/help':
                this.showHelp();
                break;
            case '/agent':
                if (parts.length > 1) {
                    const agentName = parts[1];
                    this.switchAgent(agentName);
                } else {
                    this.addSystemMessage('Usage: /agent <agent_name>');
                }
                break;
            case '/agents':
                this.listAgents();
                break;
            default:
                // Send unknown commands to server
                this.socket.emit('chat_message', {
                    message: command,
                    sessionId: 'web-session-' + Date.now()
                });
                this.typingIndicator.textContent = 'AI is typing...';
        }

        this.messageInput.value = '';
        this.updateCharCount();
        this.updateSendButton();
        this.autoResize();
    }

    switchAgent(agentName) {
        this.socket.emit('agent_switch', { agentName });
        // The response will be handled by the socket event
    }

    listAgents() {
        if (this.agents.length === 0) {
            this.addSystemMessage('No agents available');
        } else {
            const agentList = this.agents.join(', ');
            this.addSystemMessage(`Available agents: ${agentList}`);
        }
    }

    addMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${message.role}`;
        
        const headerEl = document.createElement('div');
        headerEl.className = 'message-header';
        
        const roleEl = document.createElement('span');
        roleEl.className = 'message-role';
        roleEl.textContent = message.agentName || message.role;
        
        const timestampEl = document.createElement('span');
        timestampEl.className = 'message-timestamp';
        timestampEl.textContent = new Date(message.timestamp).toLocaleTimeString();
        
        headerEl.appendChild(roleEl);
        headerEl.appendChild(timestampEl);
        
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        contentEl.innerHTML = this.formatMessageContent(message.content);
        
        messageEl.appendChild(headerEl);
        messageEl.appendChild(contentEl);
        
        // Remove welcome message if it exists
        const welcomeMsg = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
        
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        
        this.messageCount++;
        this.updateStats();
        
        // Highlight code blocks
        this.highlightCode(messageEl);
    }

    addSystemMessage(content, type = 'info') {
        const message = {
            id: 'system-' + Date.now(),
            role: 'system',
            content: content,
            timestamp: new Date()
        };
        this.addMessage(message);
    }

    formatMessageContent(content) {
        // Convert markdown to HTML
        if (typeof marked !== 'undefined') {
            return marked.parse(content);
        }
        
        // Fallback: basic formatting
        return content
            .replace(/\n/g, '<br>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }

    highlightCode(element) {
        if (typeof hljs !== 'undefined') {
            const codeBlocks = element.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                hljs.highlightElement(block);
            });
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    updateCharCount() {
        const count = this.messageInput.value.length;
        this.charCountEl.textContent = `${count}/2000`;
        
        if (count > 1800) {
            this.charCountEl.style.color = '#e74c3c';
        } else if (count > 1500) {
            this.charCountEl.style.color = '#f39c12';
        } else {
            this.charCountEl.style.color = '#666';
        }
    }

    updateSendButton() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendButton.disabled = !hasText;
    }

    autoResize() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    updateCurrentAgent(agentName) {
        this.currentAgent = agentName;
        
        const avatarEl = this.currentAgentEl.querySelector('.agent-avatar');
        const nameEl = this.currentAgentEl.querySelector('.agent-name');
        const statusEl = this.currentAgentEl.querySelector('.agent-status');
        
        if (agentName) {
            avatarEl.textContent = '🤖';
            nameEl.textContent = agentName;
            statusEl.textContent = 'Active';
        } else {
            avatarEl.textContent = '🤖';
            nameEl.textContent = 'No agent selected';
            statusEl.textContent = 'Waiting...';
        }
        
        // Update agents list active state
        this.updateAgentsListActive();
    }

    updateAgentsList(agents) {
        this.agents = agents;
        this.agentsListEl.innerHTML = '';
        
        if (agents.length === 0) {
            this.agentsListEl.innerHTML = '<div class="loading-agents">No agents available</div>';
            return;
        }
        
        agents.forEach(agent => {
            const agentEl = document.createElement('div');
            agentEl.className = 'agent-item';
            agentEl.dataset.agentName = agent;
            
            const nameEl = document.createElement('div');
            nameEl.className = 'agent-item-name';
            nameEl.textContent = agent;
            
            const descEl = document.createElement('div');
            descEl.className = 'agent-item-desc';
            descEl.textContent = 'Click to switch to this agent';
            
            agentEl.appendChild(nameEl);
            agentEl.appendChild(descEl);
            
            agentEl.addEventListener('click', () => {
                this.switchAgent(agent);
            });
            
            this.agentsListEl.appendChild(agentEl);
        });
        
        this.updateAgentsListActive();
    }

    updateAgentsListActive() {
        const agentItems = this.agentsListEl.querySelectorAll('.agent-item');
        agentItems.forEach(item => {
            if (item.dataset.agentName === this.currentAgent) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    updateStats() {
        this.messageCountEl.textContent = this.messageCount;
        this.agentSwitchesEl.textContent = this.agentSwitches;
    }

    clearChat() {
        this.messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-content">
                    <h2>Chat Cleared! 🧹</h2>
                    <p>Start a new conversation by typing a message below.</p>
                </div>
            </div>
        `;
        this.messageCount = 0;
        this.updateStats();
    }

    exportChat() {
        const messages = Array.from(this.messagesContainer.querySelectorAll('.chat-message')).map(el => {
            const role = el.querySelector('.message-role').textContent;
            const timestamp = el.querySelector('.message-timestamp').textContent;
            const content = el.querySelector('.message-content').textContent;
            return { role, timestamp, content };
        });
        
        const chatData = {
            exported: new Date().toISOString(),
            messageCount: this.messageCount,
            messages
        };
        
        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smalltalk-chat-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addSystemMessage('Chat exported successfully');
    }

    importChat() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const chatData = JSON.parse(e.target.result);
                    this.loadChatData(chatData);
                    this.addSystemMessage('Chat imported successfully');
                } catch (error) {
                    this.addSystemMessage('Failed to import chat: Invalid file format', 'error');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    loadChatData(chatData) {
        this.clearChat();
        
        if (chatData.messages && Array.isArray(chatData.messages)) {
            chatData.messages.forEach(msg => {
                const message = {
                    id: 'imported-' + Date.now() + Math.random(),
                    role: msg.role.toLowerCase(),
                    content: msg.content,
                    timestamp: new Date()
                };
                this.addMessage(message);
            });
        }
    }

    showHelp() {
        this.modalOverlay.classList.add('show');
    }

    hideModal() {
        this.modalOverlay.classList.remove('show');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SmallTalkWebApp();
});