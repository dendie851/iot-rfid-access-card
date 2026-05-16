const API_BASE = 'http://localhost:3000/api';

async function fetchUserData() {
    const cardId = document.getElementById('cardIdInput').value;
    if (!cardId) return;

    try {
        const response = await fetch(`${API_BASE}/user/${cardId}`);
        if (!response.ok) throw new Error('Kartu tidak ditemukan');
        
        const data = await response.json();
        updateUI(data);
    } catch (err) {
        alert(err.message);
        console.error(err);
    }
}

function updateUI(data) {
    // Update Balance
    const balance = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(data.user.balance);
    document.getElementById('balanceDisplay').innerText = balance;
    document.getElementById('userNameDisplay').innerText = data.user.name;

    // Update History
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';

    data.history.forEach(tx => {
        const date = new Date(tx.created_at).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });

        const statusClass = `status-${tx.status.toLowerCase()}`;
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="item-left">
                <span class="merchant-name">${tx.merchant_name}</span>
                <span class="transaction-date">${date}</span>
            </div>
            <div class="item-right">
                <span class="item-amount">Rp ${parseFloat(tx.amount).toLocaleString('id-ID')}</span>
                <br>
                <span class="item-status ${statusClass}">${tx.status}</span>
            </div>
        `;
        historyList.appendChild(item);
    });
}

// Initial fetch
window.onload = fetchUserData;

// Auto refresh every 10 seconds for real-time feel
setInterval(fetchUserData, 10000);
