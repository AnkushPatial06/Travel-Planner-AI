/* ============================================================
   Chat — real-time WebSocket chat between travelers and planners.
   ============================================================ */

/* ============================================================
   REAL-TIME USER-PLANNER CHAT
   ============================================================ */
let currentChatSocket = null;
let currentChatRoomId = null;

async function openUserChat(plannerId) {
    if (!getToken()) {
        window._pendingAfterLogin = () => openUserChat(plannerId);
        openAuthModal("login");
        showToast("Sign in to chat with a planner", "error");
        return;
    }
    
    // Close planner modal so chat can be center stage
    closePlannerModal();
    
    const modal = document.getElementById("user-chat-modal");
    const msgsContainer = document.getElementById("user-chat-messages");
    if (!modal || !msgsContainer) return;
    
    modal.classList.remove("hidden");
    msgsContainer.innerHTML = `<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
    
    try {
        // Start or get chat room
        const token = getToken();
        const roomRes = await fetch(BACKEND_URL + `/api/chat/rooms/start/${plannerId}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!roomRes.ok) throw new Error("Could not start chat");
        const room = await roomRes.json();
        currentChatRoomId = room.id;
        
        document.getElementById("user-chat-title").innerHTML = `<i class="fa-solid fa-comments"></i> Chat with ${escHtml(room.planner.name)}`;
        
        // Fetch history
        const histRes = await fetch(BACKEND_URL + `/api/chat/rooms/${room.id}/messages`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const messages = await histRes.json();
        
        msgsContainer.innerHTML = "";
        messages.forEach(m => renderUserChatMessage(m));
        scrollToChatBottom();
        
        // Connect WebSocket
        if (currentChatSocket) { currentChatSocket.close(); }
        // Determine WS URL
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = BACKEND_URL.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}//${wsHost}/api/chat/ws/${room.id}?token=${token}`;
        
        currentChatSocket = new WebSocket(wsUrl);
        
        currentChatSocket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            renderUserChatMessage(msg);
            scrollToChatBottom();
        };
        
    } catch (err) {
        msgsContainer.innerHTML = `<p class="empty-state">${escHtml(err.message)}</p>`;
    }
}

async function openExistingUserChat(roomId) {
    if (!getToken()) {
        window._pendingAfterLogin = () => openExistingUserChat(roomId);
        openAuthModal("login");
        showToast("Sign in to open chats", "error");
        return;
    }

    const modal = document.getElementById("user-chat-modal");
    const msgsContainer = document.getElementById("user-chat-messages");
    if (!modal || !msgsContainer) return;

    modal.classList.remove("hidden");
    msgsContainer.innerHTML = `<div class="dest-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;

    try {
        const token = getToken();
        currentChatRoomId = roomId;
        const histRes = await fetch(BACKEND_URL + `/api/chat/rooms/${roomId}/messages`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!histRes.ok) throw new Error("Could not load chat");
        const messages = await histRes.json();

        document.getElementById("user-chat-title").innerHTML = `<i class="fa-solid fa-comments"></i> Chat`;
        msgsContainer.innerHTML = "";
        messages.forEach(m => renderUserChatMessage(m));
        scrollToChatBottom();

        if (currentChatSocket) currentChatSocket.close();
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = BACKEND_URL.replace(/^https?:\/\//, "");
        currentChatSocket = new WebSocket(`${wsProtocol}//${wsHost}/api/chat/ws/${roomId}?token=${token}`);
        currentChatSocket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            renderUserChatMessage(msg);
            scrollToChatBottom();
        };
    } catch (err) {
        msgsContainer.innerHTML = `<p class="empty-state">${escHtml(err.message)}</p>`;
    }
}

function renderUserChatMessage(msg) {
    const msgsContainer = document.getElementById("user-chat-messages");
    const user = getUser();
    const isMe = msg.sender_id === user.id;
    
    const div = document.createElement("div");
    div.style.padding = "10px 14px";
    div.style.borderRadius = "12px";
    div.style.maxWidth = "80%";
    div.style.wordWrap = "break-word";
    
    if (isMe) {
        div.style.backgroundColor = "var(--brand)";
        div.style.color = "#fff";
        div.style.alignSelf = "flex-end";
    } else {
        div.style.backgroundColor = "var(--surface-1)";
        div.style.border = "1px solid var(--border)";
        div.style.alignSelf = "flex-start";
    }
    
    div.textContent = msg.content;
    msgsContainer.appendChild(div);
}

function scrollToChatBottom() {
    const container = document.getElementById("user-chat-messages");
    if (container) container.scrollTop = container.scrollHeight;
}

document.getElementById("user-chat-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("user-chat-input");
    const val = input.value.trim();
    if (!val || !currentChatSocket || currentChatSocket.readyState !== WebSocket.OPEN) return;
    
    currentChatSocket.send(val);
    input.value = "";
});

document.getElementById("user-chat-modal-close")?.addEventListener("click", () => {
    document.getElementById("user-chat-modal").classList.add("hidden");
    if (currentChatSocket) {
        currentChatSocket.close();
        currentChatSocket = null;
    }
    currentChatRoomId = null;
});

