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
  const search = req.query.search || ''; // Lấy từ khóa tìm kiếm từ URL

  // Xử lý câu lệnh SQL để vừa lọc theo Danh mục, vừa tìm kiếm theo Tên sản phẩm nếu có
  let sql = 'SELECT * FROM products WHERE 1=1';
  let params = [];

  if (cat !== 'all') {
    sql += ' AND category = ?';
    params.push(cat);
  }

  if (search.trim() !== '') {
    sql += ' AND name LIKE ?';
    params.push(`%${search.trim()}%`);
  }

  db.query(sql, params, (err, rows) => {
    if (err) return res.send('Lỗi: ' + err.message);

    // Tạo danh sách các mục danh mục nằm gọn trong Menu 3 gạch
    const navItems = Object.entries(CATS).map(([k, v]) => `
      <a href="/?cat=${k}${search ? '&search=' + encodeURIComponent(search) : ''}" style="
        text-decoration: none;
        color: ${cat === k ? '#000' : '#666'};
        font-weight: ${cat === k ? 'bold' : 'normal'};
        font-size: 15px;
        padding: 10px 16px;
        display: block;
        border-left: ${cat === k ? '3px solid #000' : '3px solid transparent'};
        background: ${cat === k ? '#f5f5f5' : 'transparent'};
        transition: all 0.2s;">
        ${v}
      </a>`).join('');

    // Giao diện danh sách sản phẩm (Lưới 4 cột)
    const cards = rows.length > 0 ? rows.map(p => `
      <div style="flex: 1 1 calc(25% - 24px); max-width: calc(25% - 24px); min-width: 220px; box-sizing: border-box; text-align: center; margin-bottom: 40px; cursor: pointer;" onclick="openModal(${p.id},'${p.name}',${p.price})">
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
      </div>`).join('') : `<div style="width:100%; text-align:center; color:#888; padding: 40px 0;">Không tìm thấy sản phẩm nào phù hợp.</div>`;

    res.send(`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nông Nghiệp Cao Cấp</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap');
    body { font-family: 'Montserrat', sans-serif; margin: 0; padding: 0; background-color: #ffffff; color: #000; }
    input:focus, textarea:focus { outline: 1px solid #000; }
    
    /* Hiệu ứng Sidebar Menu 3 gạch */
    #sidebar-menu { position: fixed; top: 0; left: -300px; width: 280px; height: 100%; background: white; z-index: 1000; box-shadow: 4px 0 20px rgba(0,0,0,0.1); transition: 0.3s ease; padding: 20px 0; box-sizing: border-box; }
    #sidebar-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); z-index: 999; display: none; }
  </style>
</head>
<body>

  <div id="sidebar-overlay" onclick="toggleMenu(false)"></div>
  <div id="sidebar-menu">
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 20px 20px 20px; border-bottom: 1px solid #eee;">
      <span style="font-weight: bold; font-size: 16px; letter-spacing: 1px;">DANH MỤC</span>
      <span onclick="toggleMenu(false)" style="cursor: pointer; font-size: 20px; font-weight: 300;">✕</span>
    </div>
    <div style="margin-top: 15px;">
      ${navItems}
    </div>
  </div>

  <div id="contact-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:999; align-items:center; justify-content:center;" onclick="closeContactModal(event)">
    <div style="background:white; padding:40px; width:360px; max-width:90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15); text-align: center;" onclick="event.stopPropagation()">
      <h3 style="font-family: 'Georgia', serif; font-size: 20px; font-weight: normal; margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 12px;">Thông tin liên hệ</h3>
      <p style="font-size: 14px; margin: 12px 0; color: #333;">📧 Email: <strong>latiendat2099@gmail.com</strong></p>
      <p style="font-size: 14px; margin: 12px 0; color: #333;">📞 Số điện thoại: <strong>0358865786</strong></p>
      <button onclick="document.getElementById('contact-modal').style.display='none'" style="margin-top: 24px; padding: 10px 30px; background: #000; color: white; border: none; cursor: pointer; font-size: 13px; text-transform: uppercase;">Đóng</button>
    </div>
  </div>

  <div id="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:999; align-items:center; justify-content:center;">
    <div style="background:white; padding:40px; width:400px; max-width:90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
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

  <header style="border-bottom: 1px solid #e5e5e5; padding: 20px 40px; display: flex; align-items: center; justify-content: space-between; position: relative;">
    
    <div style="display: flex; align-items: center; gap: 20px; flex: 1;">
      <span onclick="toggleMenu(true)" style="cursor:pointer; font-size: 14px; font-weight: 500; user-select: none;">☰ Menu</span>
      
      <div style="display: flex; align-items: center; border-bottom: 1px solid #ccc; padding: 2px 4px;">
        <span style="font-size: 14px; margin-right: 6px; cursor: pointer;" onclick="executeSearch()">🔍</span>
        <input id="search-input" type="text" placeholder="Tìm kiếm sản phẩm..." value="${search}" 
          onkeyup="if(event.key === 'Enter') executeSearch()"
          style="border: none; font-size: 13px; font-family: inherit; width: 160px; background: transparent;">
        ${search ? `<span onclick="clearSearch()" style="cursor:pointer; font-size:12px; color:#999; margin-left:5px;">✕</span>` : ''}
      </div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 15px; justify-content: center; flex: 1;">
      <img src="https://fashion-products-images.s3.ap-southeast-1.amazonaws.com/9b2bfa445576e42a1b7f5d58b71e6624.jpg"
        style="width:35px; height:35px; object-fit:contain; border-radius:50%">
      <h1 style="font-family: 'Georgia', serif; font-size: 24px; font-weight: normal; letter-spacing: 6px; margin: 0; text-transform: uppercase; white-space: nowrap;">
        LOUIS VUITTON
      </h1>
    </div>

    <div style="flex: 1; display: flex; justify-content: flex-end; font-size: 13px;">
      <span onclick="openContactModal()" style="cursor:pointer; font-weight: 500; border-bottom: 1px solid transparent;" onmouseover="this.style.borderBottom='1px solid #000'" onmouseout="this.style.borderBottom='1px solid transparent'">
        Liên hệ với chúng tôi
      </span>
    </div>
  </header>

  <main style="max-width: 1400px; margin: 0 auto; padding: 40px;">
    <div style="text-align: center; margin: 30px 0 60px 0;">
      <h2 style="font-family: 'Georgia', serif; font-size: 28px; font-weight: normal; margin-bottom: 8px; letter-spacing: 1px;">
        Khám phá các sáng tạo độc đáo của Nông nghiệp
      </h2>
      ${cat !== 'all' || search ? `<p style="color: #666; font-size: 14px; margin-top: 10px;">Đang xem bộ lọc: <strong>${CATS[cat] || cat}</strong> ${search ? ` - Từ khóa: "${search}"` : ''} | <a href="/" style="color:#000;">Xóa bộ lọc</a></p>` : ''}
    </div>

    <div style="display: flex; gap: 32px; flex-wrap: wrap; justify-content: flex-start;">
      ${cards}
    </div>
  </main>

  <script>
    var curProduct = {};

    // 1. Hàm đóng mở thanh Menu ẩn (Sidebar) chứa danh mục Quần, Áo, Balo
    function toggleMenu(open) {
      const sidebar = document.getElementById('sidebar-menu');
      const overlay = document.getElementById('sidebar-overlay');
      if (open) {
        sidebar.style.left = '0px';
        overlay.style.display = 'block';
      } else {
        sidebar.style.left = '-300px';
        overlay.style.display = 'none';
      }
    }

    // 2. Hàm xử lý phần thông tin liên hệ
    function openContactModal() {
      document.getElementById('contact-modal').style.display = 'flex';
    }
    function closeContactModal(e) {
      document.getElementById('contact-modal').style.display = 'none';
    }

    // 3. Hàm kích hoạt tìm kiếm theo tên sản phẩm
    function executeSearch() {
      var keyword = document.getElementById('search-input').value.trim();
      var urlParams = new URLSearchParams(window.location.search);
      var currentCat = urlParams.get('cat') || 'all';
      
      // Chuyển hướng trang kèm tham số tìm kiếm mới
      window.location.href = '/?cat=' + currentCat + '&search=' + encodeURIComponent(keyword);
    }

    function clearSearch() {
      var urlParams = new URLSearchParams(window.location.search);
      var currentCat = urlParams.get('cat') || 'all';
      window.location.href = '/?cat=' + currentCat;
    }

    // 4. Logic quản lý đặt hàng giữ nguyên từ code gốc
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
