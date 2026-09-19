(() => {
    function initializeLogout() {
        const form = document.getElementById('logout-form');
        const button = document.getElementById('logout-button');

        if (!form || form.dataset.initialized === 'true') return;
        form.dataset.initialized = 'true';

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            button.disabled = true;

            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: new FormData(form),
                    headers: { 'Accept': 'application/json' }
                });

                if (!response.ok) {
                    throw new Error(`로그아웃 실패: ${response.status}`);
                }

                if (response.redirected) {
                    window.location.replace(response.url);
                    return;
                }

                const data = await response.json();
                window.location.replace(data.redirect || '/');
            } catch (error) {
                console.error('[인증] 로그아웃 실패', error);
                button.disabled = false;
                window.alert('로그아웃하지 못했습니다. 다시 시도해 주세요.');
            }
        });
    }

    function initializeNotifications() {
        const root = document.getElementById('notification-root');
        if (!root || root.dataset.initialized === 'true') return;
        root.dataset.initialized = 'true';

        const tabs = root.querySelectorAll('.notification-tab');
        const source = document.getElementById('notification-source');
        const groupsElement = document.getElementById('notification-groups');
        const emptyElement = document.getElementById('notification-empty');
        const emptyTitle = document.getElementById('notification-empty-title');
        const toolbar = document.getElementById('notification-toolbar');
        const footer = document.getElementById('notification-footer');
        const resultCount = document.getElementById('notification-result-count');
        const badge = document.getElementById('notification-badge');
        const sortLabel = document.getElementById('notification-sort-label');
        const sortOptions = root.querySelectorAll('.notification-sort-option');
        const readAllButton = document.getElementById('notification-read-all');
        const totalCount = document.getElementById('notification-total-count');
        const visibleCount = document.getElementById('notification-visible-count');
        const limitInfo = document.getElementById('notification-limit-info');

        let notifications = Array.from(source.querySelectorAll('.notification-item'));
        let currentCategory = 'all';
        let currentSort = 'newest';
        let eventSource = null;
        let baseDocumentTitle = document.title.replace(/^\(\d+\+?\)\s*/, '');

        function updateDocumentTitle(count) {
            const value = Math.max(0, Number(count) || 0);
            const countText = value > 99 ? '99+' : String(value);
            document.title = value > 0 ? `(${countText}) ${baseDocumentTitle}` : baseDocumentTitle;
        }

        window.addEventListener('app:title-change', (event) => {
            baseDocumentTitle = String(event.detail?.title || document.title).replace(/^\(\d+\+?\)\s*/, '');
            updateDocumentTitle(badge.dataset.count);
        });

        function parseDate(value) {
            if (!value) return null;
            const date = new Date(value.trim().replace(' ', 'T'));
            return Number.isNaN(date.getTime()) ? null : date;
        }

        function startOfDay(date) {
            const result = new Date(date);
            result.setHours(0, 0, 0, 0);
            return result;
        }

        function dayDifference(date) {
            return Math.floor((startOfDay(new Date()) - startOfDay(date)) / 86400000);
        }

        function relativeTime(date) {
            const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
            if (seconds < 60) return '방금 전';
            if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
            const days = dayDifference(date);
            if (days === 1) return '어제';
            if (days < 7) return `${days}일 전`;
            if (days < 30) return `${Math.floor(days / 7)}주 전`;
            if (days < 365) return `${Math.floor(days / 30)}개월 전`;
            return `${Math.floor(days / 365)}년 전`;
        }

        function dateGroup(date) {
            const difference = dayDifference(date);
            if (difference <= 0) return { key: 'today', label: '오늘' };
            if (difference === 1) return { key: 'yesterday', label: '어제' };
            if (difference < 7) return { key: 'week', label: '최근 7일' };
            if (difference < 30) return { key: 'month', label: '최근 30일' };
            return { key: 'old', label: '이전' };
        }

        function setBadge(count) {
            const value = Math.max(0, Number(count) || 0);
            badge.dataset.count = String(value);
            badge.textContent = value > 99 ? '99+' : String(value);
            badge.classList.toggle('hidden', value === 0);
            badge.classList.toggle('flex', value > 0);
            updateDocumentTitle(value);
        }

        function updateLayout() {
            const hasItems = notifications.length > 0;
            toolbar.classList.toggle('hidden', !hasItems);
            footer.classList.toggle('hidden', !hasItems);
            if (visibleCount) visibleCount.textContent = String(notifications.length);
            if (totalCount) totalCount.textContent = String(Math.max(Number(totalCount.textContent) || 0, notifications.length));
            if (limitInfo && totalCount) limitInfo.classList.toggle('hidden', Number(totalCount.textContent) <= notifications.length);
        }

        function renderNotifications() {
            const filtered = notifications
                .filter((item) => currentCategory === 'all' || item.dataset.category === currentCategory)
                .sort((a, b) => {
                    const aTime = parseDate(a.dataset.createdAt)?.getTime() || 0;
                    const bTime = parseDate(b.dataset.createdAt)?.getTime() || 0;
                    return currentSort === 'oldest' ? aTime - bTime : bTime - aTime;
                });

            resultCount.textContent = `${filtered.length}개의 알림`;
            groupsElement.replaceChildren();
            updateLayout();

            if (filtered.length === 0) {
                emptyTitle.textContent = notifications.length === 0 ? '새로운 알림이 없습니다.' : '해당 알림이 없습니다.';
                emptyElement.classList.remove('hidden');
                emptyElement.classList.add('flex');
                return;
            }

            emptyElement.classList.add('hidden');
            emptyElement.classList.remove('flex');

            const grouped = new Map();
            filtered.forEach((item) => {
                const group = dateGroup(parseDate(item.dataset.createdAt) || new Date(0));
                if (!grouped.has(group.key)) grouped.set(group.key, { label: group.label, items: [] });
                grouped.get(group.key).items.push(item);
            });

            const order = currentSort === 'oldest'
                ? ['old', 'month', 'week', 'yesterday', 'today']
                : ['today', 'yesterday', 'week', 'month', 'old'];

            order.forEach((key) => {
                const group = grouped.get(key);
                if (!group) return;

                const section = document.createElement('section');
                section.className = 'notification-group pt-4';
                const title = document.createElement('p');
                title.className = 'mb-2 text-sm font-medium text-base-content/60';
                title.textContent = group.label;
                const list = document.createElement('div');
                list.className = 'space-y-2';

                group.items.forEach((original) => {
                    const item = original.cloneNode(true);
                    const date = parseDate(item.dataset.createdAt);
                    const time = item.querySelector('.notification-time');
                    if (date && time) {
                        time.textContent = relativeTime(date);
                        time.title = new Intl.DateTimeFormat('ko-KR', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                        }).format(date);
                    }
                    list.appendChild(item);
                });

                section.append(title, list);
                groupsElement.appendChild(section);
            });
        }

        function createNotificationElement(notification) {
            const item = document.createElement('a');
            item.href = notification.url || '#';
            item.dataset.notificationId = notification.id || '';
            item.dataset.category = notification.category || 'notice';
            item.dataset.createdAt = notification.created_at || new Date().toISOString();
            item.dataset.isRead = String(notification.is_read === true);
            item.className = 'notification-item group flex gap-3 rounded-xl bg-base-200/60 p-3 transition hover:bg-base-200';

            const avatarWrapper = document.createElement('div');
            avatarWrapper.className = 'relative shrink-0';
            if (notification.image) {
                const image = document.createElement('img');
                image.src = notification.image;
                image.alt = '';
                image.className = 'size-11 rounded-full object-cover';
                avatarWrapper.appendChild(image);
            } else {
                const avatar = document.createElement('div');
                avatar.className = 'flex size-11 items-center justify-center rounded-full bg-primary/10 font-bold text-primary';
                avatar.textContent = String(notification.sender || 'D').charAt(0);
                avatarWrapper.appendChild(avatar);
            }

            if (notification.is_read !== true) {
                const dot = document.createElement('span');
                dot.className = 'notification-unread-dot absolute -bottom-0.5 -right-0.5 size-4 rounded-full border-2 border-base-100 bg-primary';
                avatarWrapper.appendChild(dot);
            }

            const content = document.createElement('div');
            content.className = 'min-w-0 flex-1';
            const message = document.createElement('p');
            message.className = 'line-clamp-2 text-sm leading-5 text-base-content';
            message.textContent = notification.message || '새 알림이 도착했습니다.';
            const time = document.createElement('p');
            time.className = 'notification-time mt-1 text-xs text-base-content/40';
            time.textContent = notification.created_at || '방금 전';
            content.append(message, time);
            item.append(avatarWrapper, content);
            return item;
        }

        tabs.forEach((tab) => {
            tab.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                currentCategory = tab.dataset.tab;
                tabs.forEach((item) => {
                    const active = item === tab;
                    item.classList.toggle('text-primary', active);
                    item.classList.toggle('font-medium', active);
                    item.classList.toggle('text-base-content/60', !active);
                    item.querySelector('.notification-tab-line')?.classList.toggle('hidden', !active);
                });
                renderNotifications();
            });
        });

        sortOptions.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                currentSort = button.dataset.sort;
                sortLabel.textContent = currentSort === 'oldest' ? '오래된순' : '최신순';
                renderNotifications();
            });
        });

        readAllButton.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/notifications/read-all', {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' }
                });
                if (!response.ok) return;
                notifications.forEach((item) => {
                    item.dataset.isRead = 'true';
                    item.querySelector('.notification-unread-dot')?.remove();
                });
                setBadge(0);
                renderNotifications();
            } catch (error) {
                console.error('[알림] 읽음 처리 실패', error);
            }
        });

        setBadge(badge.dataset.count);
        renderNotifications();
        window.setInterval(renderNotifications, 60000);

        if ('EventSource' in window) {
            eventSource = new EventSource(root.dataset.streamUrl);
            eventSource.addEventListener('notification', (event) => {
                try {
                    const notification = JSON.parse(event.data);
                    const duplicate = notification.id && notifications.some(
                        (item) => item.dataset.notificationId === String(notification.id)
                    );
                    if (duplicate) return;

                    const element = createNotificationElement(notification);
                    source.prepend(element);
                    notifications.unshift(element);
                    if (notification.is_read !== true) setBadge(Number(badge.dataset.count) + 1);
                    if (totalCount) totalCount.textContent = String((Number(totalCount.textContent) || 0) + 1);
                    renderNotifications();
                } catch (error) {
                    console.error('[알림] 실시간 알림 처리 실패', error);
                }
            });
        }

        window.addEventListener('pagehide', () => {
            eventSource?.close();
        }, { once: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeLogout();
            initializeNotifications();
        }, { once: true });
    } else {
        initializeLogout();
        initializeNotifications();
    }
})();
