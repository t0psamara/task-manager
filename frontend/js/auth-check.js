// Проверка авторизации для основного приложения

class AuthChecker {
    constructor() {
        this.apiBase = 'http://localhost:8000/api';
        this.init();
    }

    async init() {
        // Проверяем авторизацию при загрузке страницы
        if (!AuthManager.isAuthenticated()) {
            this.redirectToAuth();
            return;
        }

        try {
            await this.verifyToken();
            this.setupUserInterface();
            this.setupLogoutHandler();
        } catch (error) {
            console.error('Ошибка проверки токена:', error);
            this.redirectToAuth();
        }
    }

    async verifyToken() {
        const token = AuthManager.getAuthToken();
        const response = await fetch(`${this.apiBase}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Токен недействителен');
        }

        const user = await response.json();
        // Обновляем информацию о пользователе
        localStorage.setItem('user_info', JSON.stringify(user));
        return user;
    }

    setupUserInterface() {
        const userInfo = AuthManager.getUserInfo();
        if (!userInfo) return;

        // Показываем информацию о пользователе
        const userInfoEl = document.getElementById('user-info');
        const userAvatarEl = document.getElementById('user-avatar');
        const userNameEl = document.getElementById('user-name');

        if (userInfoEl && userNameEl) {
            userNameEl.textContent = userInfo.name || userInfo.email;
            
            if (userAvatarEl && userInfo.avatar_url) {
                userAvatarEl.src = userInfo.avatar_url;
                userAvatarEl.style.display = 'block';
            } else if (userAvatarEl) {
                userAvatarEl.style.display = 'none';
            }

            userInfoEl.style.display = 'flex';
        }
    }

    setupLogoutHandler() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                AuthManager.logout();
            });
        }
    }

    redirectToAuth() {
        // Сохраняем текущий URL для возврата после авторизации
        const currentPath = window.location.pathname + window.location.search;
        if (currentPath !== '/' && currentPath !== '/auth.html') {
            localStorage.setItem('redirect_after_auth', currentPath);
        }
        
        window.location.href = '/auth.html';
    }

    static addAuthToRequest(url, options = {}) {
        const token = AuthManager.getAuthToken();
        if (!token) {
            throw new Error('Пользователь не авторизован');
        }

        return {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        };
    }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    new AuthChecker();
});

// Экспортируем для использования в других модулях
window.AuthChecker = AuthChecker;
