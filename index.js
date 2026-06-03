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

    // Giao diện thanh Menu điều hướng tối giản
    const nav = Object.entries(CATS).map(([k, v]) => `
      <a href="/?cat=${k}" style="
        text-decoration: none;
        color: ${cat === k ? '#000' : '#666'};
        font-weight: ${cat === k ? 'bold' : 'normal'};
        font-size: 14px;
        padding: 5px 0;
        border-bottom: ${cat === k ? '2px solid #000' : '2px solid transparent'};
        transition: all 0.2s ease;">
        ${v}
      </a>`).join('');

    // Giao diện danh sách sản phẩm hiển thị theo dạng lưới 4 cột thanh lịch
    const cards = rows.map(p => `
      <div style="flex: 1 1 calc(25% - 24px); min-width: 220px; box-sizing: border-box; text-align: center; margin-bottom: 40px; cursor: pointer;" onclick="openModal(${p.id},'${p.name}',${p.price})">
        <div style="background: #f6f6f6; width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 16px;">
          <img src="${p.image_url}" style="width: 100%; height: 100%; object-fit: cover;"
            onerror="this.src='https://via.placeholder.com/400'">
        </div>
        <div style="padding: 0 8px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: normal; color: #000; font-family: 'Georgia', serif; line-height: 1.4;">${p.name}</h3>
          <div style="font-size: 14px; color: #000; font-weight: bold; margin-bottom: 12px;">
            ${Number(p.price).toLocaleString('vi-VN')} VND
          </div>
          <button style="background: transparent; border: 1px solid #000; color: #000; padding: 8px 16px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; width: 100%; transition: background 0.3s;">
            🛒 Đặt hàng
          </button>
        </div>
      </div>`).join('');

    res.send(`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Thời Trang Cao Cấp</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap');
    body { font-family: 'Montserrat', sans-serif; margin: 0; padding: 0; background-color: #ffffff; color: #000; }
    input:focus, textarea:focus { outline: 1px solid #000; }
  </style>
</head>
<body>

  <div id="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:999; align-items:center; justify-content:center;">
    <div style="background:white; padding:40px; border-radius:0px; width:400px; max-width:90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
      <h2 id="modal-title" style="margin:0 0 24px; color:#000; font-weight:500; font-size:20px; font-family: 'Georgia', serif; border-bottom: 1px solid #eee; padding-bottom: 12px;">Đặt hàng</h2>
      <input id="inp-name" placeholder="Họ và tên *" style="width:100%; padding:12px; margin:8px 0; border:1px solid #ccc; box-sizing:border-box; font-size:14px; font-family:inherit;">
      <input id="inp-phone" placeholder="Số điện thoại *" style="width:100%; padding:12px; margin:8px 0; border:1px solid #ccc; box-sizing:border-box; font-size:14px; font-family:inherit;">
      <input id="inp-email" placeholder="Email *" style="width:100%; padding:12px; margin:8px 0; border:1px solid #ccc; box-sizing:border-box; font-size:14px; font-family:inherit;">
      <textarea id="inp-addr" placeholder="Địa chỉ giao hàng *" style="width:100%; padding:12px; margin:8px 0; border:1px solid #ccc; box-sizing:border-box; height:80px; font-size:14px; font-family:inherit; resize: none;"></textarea>
      <div style="display:flex; gap:12px; margin-top:24px;">
        <button onclick="submitOrder()" style="flex:1; padding:14px; background:#000; color:white; border:none; cursor:pointer; font-size:13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">
          ✅ Xác nhận đặt hàng
        </button>
        <button onclick="closeModal()" style="padding:14px 20px; background:#f5f5f5; border:none; color: #555; cursor:pointer; font-size:13px; text-transform: uppercase;">Huỷ</button>
      </div>
    </div>
  </div>

  <div id="success" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:999; align-items:center; justify-content:center;">
    <div style="background:white; padding:40px; text-align:center; width:380px; max-width:90%;">
      <div style="font-size:48px; margin-bottom: 16px;">🎉</div>
      <h2 style="color:#000; margin:0 0 12px; font-family: 'Georgia', serif; font-weight: normal;">Đặt hàng thành công!</h2>
      <p id="success-msg" style="color:#666; font-size: 14px; line-height:1.6; margin-bottom: 24px;"></p>
      <button onclick="document.getElementById('success').style.display='none'" style="padding:12px 40px; background:#000; color:white; border:none; cursor:pointer; font-size:13px; text-transform: uppercase; letter-spacing: 1px;">
        Đóng
      </button>
    </div>
  </div>

  <header style="border-bottom: 1px solid #e5e5e5; padding: 20px 40px; display: flex; flex-direction: column; align-items: center; position: relative;">
    <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 15px;">
      <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #000;">
        <span style="cursor:pointer;">☰ Menu</span>
        <span style="margin-left: 15px; cursor:pointer;">🔍 Tìm kiếm</span>
      </div>
      
      <div style="display: flex; align-items: center; gap: 15px; transform: translateX(30px);">
        <img src="https://fashion-products-images.s3.ap-southeast-1.amazonaws.com/9b2bfa445576e42a1b7f5d58b71e6624.jpg"
          style="width:35px; height:35px; object-fit:contain; border-radius:50%">
        <h1 style="font-family: 'Georgia', serif; font-size: 26px; font-weight: normal; letter-spacing: 6px; margin: 0; text-transform: uppercase;">
          LOUIS VUITTON
        </h1>
      </div>

      <div style="font-size: 13px; color: #000; display: flex; gap: 20px;">
        <span style="cursor:pointer;">Liên hệ với chúng tôi</span>
        <span style="cursor:pointer;">🤍</span>
        <span style="cursor:pointer;">👤</span>
      </div>
    </div>

    <nav style="display: flex; gap: 30px; margin-top: 10px; padding-bottom: 5px;">
      ${nav}
    </nav>
  </header>

  <main style="max-width: 1400px; margin: 0 auto; padding: 40px;">
    <div style="text-align: center; margin: 30px 0 60px 0;">
      <h2 style="font-family: 'Georgia', serif; font-size: 28px; font-weight: normal; margin-bottom: 8px; letter-spacing: 1px;">
        Khám phá các sáng tạo độc đáo của Louis Vuitton
      </h2>
      <p style="color: #666; font-size: 14px; margin: 0; letter-spacing: 0.5px;">Phong cách thời trang nam châu Á 2026</p>
    </div>

    <div style="display: flex; gap: 32px; flex-wrap: wrap; justify-content: flex-start;">
      ${cards}
    </div>
  </main>

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
