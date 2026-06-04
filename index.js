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

// Cấu trúc danh mục đa cấp: Đã rút gọn GIÀY DÉP chỉ còn Giày và Dép
const CATEGORY_STRUCTURE = {
  all: { label: 'Tất cả sản phẩm', sub: {} },
  ao: {
    label: 'ÁO',
    sub: {
      'ao-thun': 'Áo thun',
      'ao-polo': 'Áo polo',
      'ao-so-mi': 'Áo sơ mi',
      'ao-khoac': 'Áo khoác'
    }
  },
  quan: {
    label: 'QUẦN',
    sub: {
      'quan-jean': 'Quần jean',
      'quan-kaki': 'Quần kaki',
      'quan-short': 'Quần short'
    }
  },
  'giay-dep': {
    label: 'GIÀY DÉP',
    sub: {
      'giay': 'Giày',
      'dep': 'Dép'
    }
  },
  'do-the-thao': {
    label: 'ĐỒ THỂ THAO',
    sub: {
      'ao-the-thao': 'Áo thể thao',
      'quan-the-thao': 'Quần thể thao'
    }
  }
};

function getCategoryLabel(catKey) {
  if (catKey === 'all') return 'Tất cả sản phẩm';
  for (const [parentKey, parentValue] of Object.entries(CATEGORY_STRUCTURE)) {
    if (parentKey === catKey) return parentValue.label;
    if (parentValue.sub && parentValue.sub[catKey]) {
      return parentValue.sub[catKey];
    }
  }
  return catKey;
}

app.get('/', (req, res) => {
  const cat = req.query.cat || 'all';
  const search = req.query.search || ''; 

  let sql = 'SELECT * FROM products WHERE 1=1';
  let params = [];

  // Lắp logic xử lý danh mục chuẩn khớp với DB của bạn
  if (cat !== 'all') {
    if (CATEGORY_STRUCTURE[cat] && Object.keys(CATEGORY_STRUCTURE[cat].sub).length > 0) {
      sql += ' AND subcategory = ?';
      params.push(cat);
    } else {
      sql += ' AND category = ?';
      params.push(cat);
    }
  }

  if (search.trim() !== '') {
    sql += ' AND name LIKE ?';
    params.push(`%${search.trim()}%`);
  }

  db.query(sql, params, (err, rows) => {
    if (err) return res.send('Lỗi: ' + err.message);

    let navItemsHtml = `
      <a href="/?cat=all${search ? '&search=' + encodeURIComponent(search) : ''}" style="
        text-decoration: none; color: ${cat === 'all' ? '#000' : '#555'};
        font-weight: ${cat === 'all' ? '600' : '400'}; font-size: 13px;
        letter-spacing: 1px; padding: 14px 24px; display: block;
        text-transform: uppercase; border-left: ${cat === 'all' ? '2px solid #000' : '2px solid transparent'};
        background: ${cat === 'all' ? '#f9f9f9' : 'transparent'}; transition: all 0.2s;">
        Tất cả sản phẩm
      </a>`;

    Object.entries(CATEGORY_STRUCTURE).forEach(([parentKey, parentValue]) => {
      if (parentKey === 'all') return;
      
      const isParentActive = cat === parentKey || (parentValue.sub && Object.keys(parentValue.sub).includes(cat));

      navItemsHtml += `
        <div style="border-bottom: 1px solid #fcfcfc;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; background: ${isParentActive ? '#fcfcfc' : 'transparent'};">
            <a href="/?cat=${parentKey}${search ? '&search=' + encodeURIComponent(search) : ''}" style="
              text-decoration: none; color: #000; font-weight: 500; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase;">
              ${parentValue.label}
            </a>
          </div>
          <div style="padding-bottom: 8px; padding-left: 12px;">
            ${Object.entries(parentValue.sub).map(([subKey, subLabel]) => `
              <a href="/?cat=${subKey}${search ? '&search=' + encodeURIComponent(search) : ''}" style="
                text-decoration: none; color: ${cat === subKey ? '#000' : '#666'};
                font-weight: ${cat === subKey ? '600' : '400'}; font-size: 13px;
                padding: 8px 24px; display: block; letter-spacing: 0.5px;
                border-left: ${cat === subKey ? '2px solid #000' : '2px solid transparent'};
                transition: all 0.2s;">
                • ${subLabel}
              </a>`).join('')}
          </div>
        </div>`;
    });

    const cards = rows.length > 0 ? rows.map(p => `
      <div style="flex: 1 1 calc(25% - 24px); max-width: calc(25% - 24px); min-width: 220px; box-sizing: border-box; text-align: center; margin-bottom: 40px; cursor: pointer;" onclick="openModal(${p.id},'${p.name}',${p.price})">
        <div style="background: #f6f6f6; width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 16px;">
          <img src="${p.image_url}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'"
            onerror="this.src='https://via.placeholder.com/400'">
        </div>
        <div style="padding: 0 8px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 400; color: #000; font-family: 'Playfair Display', 'Georgia', serif; line-height: 1.4; letter-spacing: 0.2px;">${p.name}</h3>
          <div style="font-size: 14px; color: #000; font-weight: 600; margin-bottom: 12px; font-family: 'Montserrat', sans-serif;">
            ${Number(p.price).toLocaleString('vi-VN')} VND
          </div>
          <button style="background: transparent; border: 1px solid #000; color: #000; padding: 10px 16px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer; width: 100%; font-family: 'Montserrat', sans-serif; transition: all 0.3s;" onmouseover="this.style.background='#000'; this.style.color='#fff';" onmouseout="this.style.background='transparent'; this.style.color='#000';">
            🛒 Đặt hàng
          </button>
        </div>
      </div>`).join('') : `<div style="width:100%; text-align:center; color:#888; font-family:'Playfair Display', 'Georgia', serif; padding: 60px 0; font-style: italic;">Không tìm thấy sản phẩm nào phù hợp.</div>`;

    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>THE MOON - Thời Trang Nam Cao Cấp</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">

  <style>
    body { 
      font-family: "Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; 
      margin: 0; padding: 0; background-color: #ffffff; color: #000; 
      -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    }
    h1, h2, h3, .brand-title { font-family: "Playfair Display", "Georgia", serif !important; }
    input#search-input:focus-visible, input#search-input:focus { outline: none !important; box-shadow: none !important; }
    input:focus, textarea:focus { outline: 1px solid #000; }
    #sidebar-menu { position: fixed; top: 0; left: -320px; width: 300px; height: 100%; background: white; z-index: 1000; box-shadow: 4px 0 30px rgba(0,0,0,0.05); transition: 0.4s cubic-bezier(0.25, 1, 0.5, 1); padding: 30px 0; box-sizing: border-box; overflow-y: auto; }
    #sidebar-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.2); z-index: 999; display: none; backdrop-filter: blur(2px); }
  </style>
</head>
<body>

  <div id="sidebar-overlay" onclick="toggleMenu(false)"></div>
  <div id="sidebar-menu">
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 24px 24px 24px; border-bottom: 1px solid #f0f0f0;">
      <span style="font-weight: 500; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">Danh mục</span>
      <span onclick="toggleMenu(false)" style="cursor: pointer; font-size: 18px; font-weight: 300; color:#666;">✕</span>
    </div>
    <div style="margin-top: 15px;">
      ${navItemsHtml}
    </div>
  </div>

  <div id="contact-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.3); z-index:999; align-items:center; justify-content:center; backdrop-filter: blur(4px);" onclick="document.getElementById('contact-modal').style.display='none'">
    <div style="background:white; padding:48px 40px; width:400px; max-width:90%; border: 1px solid #eaeaea; text-align: center;" onclick="event.stopPropagation()">
      <h3 style="font-family: 'Playfair Display', serif; font-size: 22px; font-weight: normal; margin-top: 0; margin-bottom: 28px; letter-spacing: 0.5px;">Thông tin liên hệ</h3>
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin: 18px 0; padding: 12px; background: #fafafa;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        <span style="font-size: 14px; color: #222; font-weight: 400; letter-spacing: 0.3px; font-family: 'Montserrat', sans-serif;">latiendat2099@gmail.com</span>
      </div>
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin: 18px 0; padding: 12px; background: #fafafa;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        <span style="font-size: 14px; color: #222; font-weight: 500; letter-spacing: 0.5px; font-family: 'Montserrat', sans-serif;">0358865786</span>
      </div>
      <button onclick="document.getElementById('contact-modal').style.display='none'" style="margin-top: 24px; padding: 12px 40px; background: #000; color: white; border: none; cursor: pointer; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500; width: 100%; font-family: 'Montserrat', sans-serif;">Đóng</button>
    </div>
  </div>

  <div id="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.3); z-index:999; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
    <div style="background:white; padding:44px 40px; width:420px; max-width:90%; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
      <h2 id="modal-title" style="margin:0 0 24px; color:#000; font-weight:400; font-size:20px; font-family: 'Playfair Display', serif; border-bottom: 1px solid #eee; padding-bottom: 14px;">Đặt hàng</h2>
      <input id="inp-name" placeholder="Họ và tên *" style="width:100%; padding:14px; margin:8px 0; border:1px solid #ddd; box-sizing:border-box; font-size:14px; font-family:inherit;">
      <input id="inp-phone" placeholder="Số điện thoại *" style="width:100%; padding:14px; margin:8px 0; border:1px solid #ddd; box-sizing:border-box; font-size:14px; font-family:inherit;">
      <input id="inp-email" placeholder="Email *" style="width:100%; padding:14px; margin:8px 0; border:1px solid #ddd; box-sizing:border-box; font-size:14px; font-family:inherit;">
      <textarea id="inp-addr" placeholder="Địa chỉ giao hàng *" style="width:100%; padding:14px; margin:8px 0; border:1px solid #ddd; box-sizing:border-box; height:80px; font-size:14px; font-family:inherit; resize: none;"></textarea>
      <div style="display:flex; gap:12px; margin-top:28px;">
        <button onclick="submitOrder()" style="flex:1; padding:14px; background:#000; color:white; border:none; cursor:pointer; font-size:12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; font-family: 'Montserrat', sans-serif;">
          ✅ Xác nhận đặt hàng
        </button>
        <button onclick="closeModal()" style="padding:14px 20px; background:#f5f5f5; border:none; color: #555; cursor:pointer; font-size:12px; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Montserrat', sans-serif;">Huỷ</button>
      </div>
    </div>
  </div>

  <div id="success" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.3); z-index:999; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
    <div style="background:white; padding:44px; text-align:center; width:380px; max-width:90%; box-shadow: 0 10px 40px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
      <h2 style="color:#000; margin:0 0 16px; font-family: 'Playfair Display', serif; font-weight: 500; font-size: 22px; letter-spacing: 0.5px;">Đặt hàng thành công!</h2>
      <p id="success-msg" style="color:#555; font-size: 14px; line-height:1.6; margin-bottom: 28px; font-family: 'Montserrat', sans-serif; font-weight: 300;"></p>
      <button onclick="document.getElementById('success').style.display='none'" style="padding:12px 40px; background:#000; color:white; border:none; cursor:pointer; font-size:11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500; width: 100%; font-family: 'Montserrat', sans-serif;">Đóng</button>
    </div>
  </div>

  <header style="border-bottom: 1px solid #f0f0f0; padding: 24px 40px; display: flex; align-items: center; justify-content: space-between; position: relative; background: #fff;">
    <div style="display: flex; align-items: center; gap: 28px; flex: 1;">
      <span onclick="toggleMenu(true)" style="cursor:pointer; font-size: 12px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase; user-select: none; display: flex; align-items: center; gap: 6px; font-family: 'Montserrat', sans-serif;">
        <span>☰</span> Danh mục
      </span>
      <div style="display: flex; align-items: center; border-bottom: 1px solid #e0e0e0; padding: 4px 0; transition: border-color 0.3s;" id="search-container">
        <span style="font-size: 13px; margin-right: 8px; cursor: pointer; display: flex; align-items: center;" onclick="executeSearch()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </span>
        <input id="search-input" type="text" placeholder="Tìm kiếm" value="${search}" 
          onkeyup="if(event.key === 'Enter') executeSearch()"
          onfocus="document.getElementById('search-container').style.borderBottom='1px solid #000'"
          onblur="document.getElementById('search-container').style.borderBottom='1px solid #e0e0e0'"
          style="border: none; font-size: 12px; font-family: 'Montserrat', sans-serif; width: 130px; background: transparent; letter-spacing: 0.5px; padding: 0;">
        ${search ? `<span onclick="clearSearch()" style="cursor:pointer; font-size:11px; color:#aaa; margin-left:6px; font-weight:bold;">✕</span>` : ''}
      </div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 14px; justify-content: center; flex: 1;">
      <img src="https://fashion-products-images.s3.ap-southeast-1.amazonaws.com/logoo.png" style="width:30px; height:30px; object-fit:contain; border-radius:50%">
      <h1 style="font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 400; letter-spacing: 7px; margin: 0; text-transform: uppercase; white-space: nowrap;">
        THE MOON
      </h1>
    </div>

    <div style="flex: 1; display: flex; justify-content: flex-end; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; font-family: 'Montserrat', sans-serif;">
      <span onclick="document.getElementById('contact-modal').style.display='flex'" style="cursor:pointer; font-weight: 500; border-bottom: 1px solid transparent; transition: all 0.3s;" onmouseover="this.style.borderBottom='1px solid #000'" onmouseout="this.style.borderBottom='1px solid transparent'">
        Liên hệ với chúng tôi
      </span>
    </div>
  </header>

  <main style="max-width: 1400px; margin: 0 auto; padding: 0 40px 40px 40px;">
    
    <div style="width: 100%; max-width: 1200px; margin: 30px auto 0 auto; overflow: hidden; border-radius: 4px; box-shadow: 0 12px 35px rgba(0,0,0,0.04);">
      <img src="https://fashion-products-images.s3.ap-southeast-1.amazonaws.com/afdcbc26-510e-4ccf-aa4d-c9c92d1cc4e5.png" 
           style="width: 100%; height: auto; display: block; object-fit: cover; max-height: 440px;">
    </div>

    <div style="text-align: center; margin: 35px 0 55px 0;">
      <h2 style="font-family: 'Playfair Display', serif; font-size: 25px; font-weight: 500; margin-bottom: 8px; letter-spacing: 1.5px; color: #111111;">
        Thời trang nam cao cấp 2026
      </h2>
      <p style="color: #666666; font-size: 13px; margin-top: 12px; font-family:'Playfair Display', serif; font-style:italic; letter-spacing: 0.5px;">
        Đang hiển thị: <span style="font-family:'Montserrat', sans-serif; font-style: normal; font-weight: 500; color: #000;">${getCategoryLabel(cat)}</span> ${search ? ` chứa từ khóa "${search}"` : ''} 
        ${cat !== 'all' || search ? ` | <a href="/" style="color:#000; font-family:'Montserrat',sans-serif; text-transform:uppercase; font-size:11px; margin-left:10px; letter-spacing:1px; font-style:normal; font-weight:600; text-decoration:none; border-bottom:1px solid #000;">Xóa bộ lọc</a>` : ''}
      </p>
    </div>

    <div style="display: flex; gap: 32px; flex-wrap: wrap; justify-content: flex-start; max-width: 1200px; margin: 0 auto;">
      ${cards}
    </div>
  </main>

  <script>
    var curProduct = {};

    function toggleMenu(open) {
      const sidebar = document.getElementById('sidebar-menu');
      const overlay = document.getElementById('sidebar-overlay');
      if (open) {
        sidebar.style.left = '0px';
        overlay.style.display = 'block';
      } else {
        sidebar.style.left = '-320px';
        overlay.style.display = 'none';
      }
    }

    function executeSearch() {
      var keyword = document.getElementById('search-input').value.trim();
      var urlParams = new URLSearchParams(window.location.search);
      var currentCat = urlParams.get('cat') || 'all';
      window.location.href = '/?cat=' + currentCat + '&search=' + encodeURIComponent(keyword);
    }

    function clearSearch() {
      var urlParams = new URLSearchParams(window.location.search);
      var currentCat = urlParams.get('cat') || 'all';
      window.location.href = '/?cat=' + currentCat;
    }

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
          '</b> đã được ghi nhận thành công.<br>Chúng tôi sẽ sớm liên hệ tới số điện thoại <b>' + phone + '</b>.';
        document.getElementById('success').style.display = 'flex';
      });
    }
  </script>
</body>
</html>`);
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
