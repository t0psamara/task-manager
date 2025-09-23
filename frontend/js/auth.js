// Скрипт для авторизации через OAuth провайдеры

class AuthManager {
    constructor() {
        this.apiBase = 'http://localhost:8000/api';
        this.init();
    }

    init() {
        this.attachEventListeners();
        this.checkExistingAuth();
    }

    attachEventListeners() {
        const googleBtn = document.getElementById('google-login');
        const yandexBtn = document.getElementById('yandex-login');

        googleBtn.addEventListener('click', () => this.loginWithGoogle());
        yandexBtn.addEventListener('click', () => this.loginWithYandex());
    }

    async checkExistingAuth() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            try {
                const response = await fetch(`${this.apiBase}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    // Пользователь уже авторизован, перенаправляем на главную
                    this.redirectToApp();
                    return;
                }
            } catch (error) {
                console.log('Токен недействителен');
            }
            
            // Удаляем недействительный токен
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
        }
    }

    async loginWithGoogle() {
        await this.initiateOAuth('google');
    }

    async loginWithYandex() {
        await this.initiateOAuth('yandex');
    }

    async initiateOAuth(provider) {
        const btn = document.getElementById(`${provider}-login`);
        this.setButtonLoading(btn, true);
        this.showMessage('Перенаправление на страницу авторизации...', 'loading');

        try {
            const response = await fetch(`${this.apiBase}/auth/${provider}`);
            const data = await response.json();

            if (data.authorization_url) {
                // Сохраняем провайдер для обработки callback
                localStorage.setItem('oauth_provider', provider);
                // Перенаправляем на страницу OAuth
                window.location.href = data.authorization_url;
            } else {
                throw new Error('Не удалось получить URL авторизации');
            }
        } catch (error) {
            this.showMessage(`Ошибка авторизации: ${error.message}`, 'error');
            this.setButtonLoading(btn, false);
        }
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    showMessage(text, type = 'info') {
        const messageEl = document.getElementById('status-message');
        messageEl.textContent = text;
        messageEl.className = `status-message ${type}`;
        
        if (type === 'success') {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        }
    }

    async handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const provider = localStorage.getItem('oauth_provider');

        if (error) {
            this.showMessage(`Ошибка авторизации: ${error}`, 'error');
            return;
        }

        if (!code || !provider) {
            this.showMessage('Неверные параметры авторизации', 'error');
            return;
        }

        this.showMessage('Завершение авторизации...', 'loading');

        try {
            const response = await fetch(`${this.apiBase}/auth/${provider}/callback?code=${code}`);
            const data = await response.json();

            if (response.ok && data.access_token) {
                // Сохраняем токен и информацию о пользователе
                localStorage.setItem('auth_token', data.access_token);
                localStorage.setItem('user_info', JSON.stringify(data.user));
                localStorage.removeItem('oauth_provider');

                this.showMessage('Успешная авторизация! Перенаправление...', 'success');
                
                // Перенаправляем на главную страницу через 1 секунду
                setTimeout(() => {
                    this.redirectToApp();
                }, 1000);
            } else {
                throw new Error(data.detail || 'Ошибка авторизации');
            }
        } catch (error) {
            this.showMessage(`Ошибка: ${error.message}`, 'error');
            localStorage.removeItem('oauth_provider');
        }
    }

    redirectToApp() {
        // Пытаемся получить board_id из URL для прямого перехода к доске
        const urlParams = new URLSearchParams(window.location.search);
        const boardLink = urlParams.get('board_link');
        
        if (boardLink) {
            window.location.href = `/board/${boardLink}`;
        } else {
            window.location.href = '/';
        }
    }

    static getUserInfo() {
        const userInfo = localStorage.getItem('user_info');
        return userInfo ? JSON.parse(userInfo) : null;
    }

    static getAuthToken() {
        return localStorage.getItem('auth_token');
    }

    static isAuthenticated() {
        return !!this.getAuthToken();
    }

    static logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.href = '/auth.html';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();

    // Если мы на странице callback, обрабатываем его
    if (window.location.search.includes('code=')) {
        authManager.handleOAuthCallback();
    }
});

// Экспортируем класс для использования в других модулях
window.AuthManager = AuthManager;
