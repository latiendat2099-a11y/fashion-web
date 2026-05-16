const express = require('express');
const mysql = require('mysql2');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const app = express();
app.use(express.json());

const sqs = new SQSClient({ region: 'ap-southeast-1' });

const db = mysql.createConnection({
  host: 'fashion-db.cj20yykym4nu.ap-southeast-1.rds.amazonaws.com',
  user: 'admin',
  password: 'Fashion2024!',
  database: 'fashiondb'
});
db.connect(err => {
  if (err) { console.log(err); return; }
  console.log('Kết nối DB thành công!');
});

const CATS = {
  all: 'Tất cả',
  ao: 'Áo',
  quan: 'Quần',
  giay: 'Giày',
  dep: 'Dép',
  balo: 'Balo'
};

app.get('/', (req, res) => {
  const cat = req.query.cat || 'all';
  const sql = cat === 'all' ? 'SELECT * FROM products' : 'SELECT * FROM products WHERE category=?';
  db.query(sql, cat === 'all' ? [] : [cat], (err, rows) => {
    if (err) return res.send('Lỗi: ' + err.message);

    const nav = Object.entries(CATS).map(([k, v]) => `
      <a href="/?cat=${k}" style="
        display:inline-block;padding:8px 18px;margin:4px;
        border-radius:20px;text-decoration:none;
        background:${cat === k ? '#222' : '#eee'};
        color:${cat === k ? '#fff' : '#333'};font-size:14px">
        ${v}
      </a>`).join('');

    const cards = rows.map(p => `
      <div style="background:white;border-radius:10px;overflow:hidden;
        width:200px;box-shadow:0 2px 10px rgba(0,0,0,0.08)">
        <img src="${p.image_url}" style="width:100%;height:200px;object-fit:cover"
          onerror="this.src='https://via.placeholder.com/200'">
        <div style="padding:14px">
          <div style="font-size:12px;background:#f0f0f0;display:inline-block;
            padding:2px 8px;border-radius:10px;margin-bottom:6px">
            ${CATS[p.category] || p.category}
          </div>
          <h3 style="margin:4px 0;font-size:15px">${p.name}</h3>
          <div style="color:#e33;font-weight:bold;margin:6px 0">
            ${Number(p.price).toLocaleString('vi-VN')} VND
          </div>
          <button onclick="openModal(${p.id},'${p.name}',${p.price})"
            style="width:100%;padding:10px;background:#222;color:white;
            border:none;border-radius:6px;cursor:pointer;font-size:14px">
            🛒 Đặt hàng
          </button>
        </div>
      </div>`).join('');

    res.send(`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fashion Shop</title>
</head>
<body style="font-family:sans-serif;padding:24px;background:#f5f5f5;margin:0">

  <div id="modal" style="display:none;position:fixed;top:0;left:0;
    width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999;
    align-items:center;justify-content:center">
    <div style="background:white;padding:32px;border-radius:12px;
      width:420px;max-width:90%">
      <h2 id="modal-title" style="margin:0 0 20px;color:#222">Đặt hàng</h2>
      <input id="inp-name" placeholder="Họ và tên *"
        style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;
        border-radius:6px;box-sizing:border-box;font-size:14px">
      <input id="inp-phone" placeholder="Số điện thoại *"
        style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;
        border-radius:6px;box-sizing:border-box;font-size:14px">
      <input id="inp-email" placeholder="Email *"
        style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;
        border-radius:6px;box-sizing:border-box;font-size:14px">
      <textarea id="inp-addr" placeholder="Địa chỉ giao hàng *"
        style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;
        border-radius:6px;box-sizing:border-box;height:80px;font-size:14px"></textarea>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button onclick="submitOrder()"
          style="flex:1;padding:12px;background:#222;color:white;
          border:none;border-radius:6px;cursor:pointer;font-size:15px">
          ✅ Xác nhận đặt hàng
        </button>
        <button onclick="closeModal()"
          style="padding:12px 16px;background:#eee;border:none;
          border-radius:6px;cursor:pointer;font-size:14px">Huỷ</button>
      </div>
    </div>
  </div>

  <div id="success" style="display:none;position:fixed;top:0;left:0;
    width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999;
    align-items:center;justify-content:center">
    <div style="background:white;padding:40px;border-radius:12px;
      text-align:center;width:380px;max-width:90%">
      <div style="font-size:64px">🎉</div>
      <h2 style="color:#2a9d2a;margin:12px 0">Đặt hàng thành công!</h2>
      <p id="success-msg" style="color:#666;line-height:1.6"></p>
      <button onclick="document.getElementById('success').style.display='none'"
        style="padding:12px 32px;background:#222;color:white;border:none;
        border-radius:6px;cursor:pointer;font-size:15px;margin-top:8px">
        Đóng
      </button>
    </div>
  </div>

  <h1 style="color:#222;margin-bottom:4px">👗 Fashion Shop</h1>
  <p style="color:#888;margin:0 0 20px">Thời trang chất lượng cao</p>
  <div style="margin-bottom:24px">${nav}</div>
  <div style="display:flex;gap:16px;flex-wrap:wrap">${cards}</div>

  <script>
    var curProduct = {};
    function openModal(id, name, price) {
      curProduct = { id, name, price };
      document.getElementById('modal-title').innerText = 'Đặt hàng: ' + name;
      document.getElementById('modal').style.display = 'flex';
    }
    function closeModal() {
      document.getElementById('modal').style.display = 'none';
    }
    function submitOrder() {
      var name = document.getElementById('inp-name').value.trim();
      var phone = document.getElementById('inp-phone').value.trim();
      var email = document.getElementById('inp-email').value.trim();
      var addr = document.getElementById('inp-addr').value.trim();
      if (!name || !phone || !email || !addr) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
      }
      fetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: curProduct.id,
          quantity: 1,
          total_price: curProduct.price,
          customer_name: name,
          phone: phone,
          email: email,
          address: addr
        })
      })
      .then(r => r.json())
      .then(d => {
        closeModal();
        document.getElementById('success-msg').innerHTML =
          'Cảm ơn <b>' + name + '</b>!<br>Đơn hàng <b>' + curProduct.name +
          '</b> đã được ghi nhận.<br>Chúng tôi sẽ liên hệ qua SĐT <b>' + phone + '</b>.';
        document.getElementById('success').style.display = 'flex';
      });
    }
  </script>
</body></html>`);
  });
});

// ===== PHẦN SỬA: Đẩy đơn hàng vào SQS thay vì lưu thẳng RDS =====
app.post('/orders', async (req, res) => {
  const { product_id, quantity, total_price, customer_name, phone, email, address } = req.body;
  
  try {
    await sqs.send(new SendMessageCommand({
      QueueUrl: 'https://sqs.ap-southeast-1.amazonaws.com/054653532752/order-queue',
      MessageBody: JSON.stringify({
        product_id, quantity, total_price,
        customer_name, phone, email, address
      })
    }));
    res.json({ message: 'OK' });
  } catch (err) {
    console.error('SQS Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Server chạy tại port 3000'));
