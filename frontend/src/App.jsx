
import { useEffect, useState } from 'react'
import './App.css'

const API = '/api'
const USER_KEY = 'laundryUser'

const clothingTypes = [
  { name: 'เสื้อแขนสั้น', price: 13 },
  { name: 'เสื้อแขนยาว', price: 15 },
  { name: 'กางเกงขายาว', price: 15 },
  { name: 'กางเกงขาสั้น', price: 13 },
]

const emptyItem = () => ({
  item_type: 'เสื้อแขนสั้น',
  quantity: 1,
  unit_price: 13,
})

function readSavedUser() {
  try {
    const saved = sessionStorage.getItem(USER_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (error) {
    console.error('อ่านสถานะ Login ไม่สำเร็จ:', error)
    return null
  }
}

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(readSavedUser)
  const [activeMenu, setActiveMenu] = useState('หน้าหลัก')
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState(null)

  const [customers, setCustomers] = useState([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([emptyItem()])
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderMessage, setOrderMessage] = useState('')
  const [orderError, setOrderError] = useState('')

  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [savingCustomer, setSavingCustomer] = useState(false)

  const totalAmount = items.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0,
  )

  useEffect(() => {
    if (!user) return

    if (activeMenu === 'จัดการรายการรับผ้า') {
      loadCustomers()
    }

    if (activeMenu === 'สถานะงานซักรีด') {
      loadOrders()
    }
  }, [user, activeMenu])

  async function loadOrders() {
    setOrdersLoading(true)
    setOrdersError('')

    try {
      const response = await fetch(`${API}/laundry-orders`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'โหลดรายการซักรีดไม่สำเร็จ')
      }

      setOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      setOrdersError(error.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setOrdersLoading(false)
    }
  }

  async function updateOrderStatus(orderId, status) {
    setUpdatingOrderId(orderId)
    setOrdersError('')

    try {
      const response = await fetch(`${API}/laundry-orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'เปลี่ยนสถานะไม่สำเร็จ')
      }

      await loadOrders()
    } catch (error) {
      setOrdersError(error.message || 'เปลี่ยนสถานะไม่สำเร็จ')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  async function loadCustomers() {
    setCustomersLoading(true)

    try {
      const response = await fetch(`${API}/customers`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'ไม่สามารถโหลดรายชื่อลูกค้าได้')
      }

      setCustomers(Array.isArray(data) ? data : [])
    } catch (error) {
      setOrderError(error.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setCustomersLoading(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()

    if (!username.trim() || !password) {
      alert('กรุณากรอก Username และ Password')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Username หรือ Password ไม่ถูกต้อง')
        return
      }

      const loggedInUser = {
        username: data.username,
        fullName: data.full_name,
      }

      try {
        sessionStorage.setItem(USER_KEY, JSON.stringify(loggedInUser))
        console.log(
          'บันทึก Login:',
          sessionStorage.getItem(USER_KEY),
        )
      } catch (storageError) {
        console.error('บันทึก Login ไม่สำเร็จ:', storageError)
        alert('เบราว์เซอร์ไม่อนุญาตให้จำสถานะ Login')
      }

      setUser(loggedInUser)
      setPassword('')
    } catch (error) {
      console.error('Login error:', error)
      alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    try {
      sessionStorage.removeItem(USER_KEY)
    } catch (error) {
      console.error('ลบสถานะ Login ไม่สำเร็จ:', error)
    }

    setUser(null)
    setUsername('')
    setPassword('')
    setActiveMenu('หน้าหลัก')
  }

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item

        if (field === 'item_type') {
          const selected = clothingTypes.find((type) => type.name === value)
          return {
            ...item,
            item_type: value,
            unit_price: selected ? selected.price : 0,
          }
        }

        return { ...item, [field]: value }
      }),
    )
  }

  async function handleCreateCustomer(event) {
    event.preventDefault()
    setOrderError('')
    setOrderMessage('')

    if (!newCustomerName.trim()) {
      setOrderError('กรุณากรอกชื่อลูกค้า')
      return
    }

    setSavingCustomer(true)

    try {
      const response = await fetch(`${API}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'เพิ่มลูกค้าไม่สำเร็จ')
      }

      await loadCustomers()

      const createdId = data.id ?? data.customer_id
      if (createdId != null) {
        setCustomerId(String(createdId))
      }

      setNewCustomerName('')
      setNewCustomerPhone('')
      setShowNewCustomer(false)
      setOrderMessage('เพิ่มลูกค้าเรียบร้อยแล้ว')
    } catch (error) {
      setOrderError(error.message || 'เพิ่มลูกค้าไม่สำเร็จ')
    } finally {
      setSavingCustomer(false)
    }
  }

  async function handleCreateOrder(event) {
    event.preventDefault()
    setOrderMessage('')
    setOrderError('')

    if (!customerId) {
      setOrderError('กรุณาเลือกลูกค้า')
      return
    }

    if (!pickupDate) {
      setOrderError('กรุณาระบุวันนัดรับผ้า')
      return
    }

    if (
      items.some(
        (item) =>
          !item.item_type ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) < 1 ||
          !Number.isFinite(Number(item.unit_price)) ||
          Number(item.unit_price) < 0,
      )
    ) {
      setOrderError('กรุณาตรวจสอบประเภทผ้า จำนวน และราคา')
      return
    }

    setSavingOrder(true)

    try {
      const response = await fetch(`${API}/laundry-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: Number(customerId),
          pickup_date: pickupDate,
          notes: notes.trim(),
          items: items.map((item) => ({
            item_type: item.item_type,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'บันทึกรายการรับผ้าไม่สำเร็จ')
      }

      setOrderMessage(
        `บันทึกรายการรับผ้าสำเร็จ เลขที่รายการ ${data.order_id} รวม ฿${Number(data.total_amount).toFixed(2)}`,
      )

      setCustomerId('')
      setPickupDate('')
      setNotes('')
      setItems([emptyItem()])
    } catch (error) {
      setOrderError(error.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setSavingOrder(false)
    }
  }

  if (user) {
    const menus = [
      'หน้าหลัก',
      'จัดการรายการรับผ้า',
      'สถานะงานซักรีด',
      'รับชำระเงิน',
      'รายงานยอดขาย',
    ]

    return (
      <main className="dashboard-page">
        <aside className="dashboard-sidebar">
          <div className="dashboard-brand">
            <div className="dashboard-logo">🧺</div>
            <div>
              <h2>FRESH &amp; FOLD</h2>
              <p>Laundry Management</p>
            </div>
          </div>

          <p className="sidebar-label">MENU</p>

          <nav className="dashboard-nav">
            {menus.map((menu, index) => (
              <button
                key={menu}
                type="button"
                className={activeMenu === menu ? 'active' : ''}
                onClick={() => setActiveMenu(menu)}
              >
                <span>{['⌂', '🧺', '📋', '฿', '▤'][index]}</span>
                {menu}
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            <span>↪</span> ออกจากระบบ
          </button>
        </aside>

        <section className="dashboard-content">
          <header className="dashboard-header">
            <div>
              <p className="dashboard-eyebrow">FRESH &amp; FOLD</p>
              <h1>{activeMenu}</h1>
              <p>จัดการร้านซักรีดของคุณได้ง่าย ๆ ในที่เดียว</p>
            </div>

            <div className="dashboard-profile">
              <div className="profile-avatar">👩🏻</div>
              <div>
                <strong>{user.fullName}</strong>
                <span>ผู้ดูแลระบบ</span>
              </div>
            </div>
          </header>

          {activeMenu === 'หน้าหลัก' ? (
            <>
              <section className="welcome-banner">
                <div>
                  <p>WELCOME BACK 👋</p>
                  <h2>สวัสดี, {user.fullName}</h2>
                  <span>พร้อมจัดการงานซักรีดวันนี้แล้วหรือยัง?</span>
                </div>
                <div className="banner-icon">🧺</div>
              </section>

              <h2 className="section-heading">ภาพรวมร้าน</h2>

              <section className="dashboard-stats">
                <article className="stat-card">
                  <div className="stat-icon">🧺</div>
                  <p>รายการรับผ้าทั้งหมด</p>
                  <h3>0 <span>รายการ</span></h3>
                </article>
                <article className="stat-card">
                  <div className="stat-icon">🫧</div>
                  <p>กำลังดำเนินการ</p>
                  <h3>0 <span>รายการ</span></h3>
                </article>
                <article className="stat-card">
                  <div className="stat-icon">✨</div>
                  <p>รอลูกค้ามารับ</p>
                  <h3>0 <span>รายการ</span></h3>
                </article>
                <article className="stat-card">
                  <div className="stat-icon">💰</div>
                  <p>ยอดรับชำระวันนี้</p>
                  <h3>฿0.00</h3>
                </article>
              </section>

              <section className="dashboard-lower">
                <article className="dashboard-panel">
                  <h2>เมนูด่วน</h2>
                  <p>เลือกเมนูเพื่อเริ่มทำงาน</p>
                  <div className="quick-actions">
                    <button
                      type="button"
                      onClick={() => setActiveMenu('จัดการรายการรับผ้า')}
                    >
                      <span>＋</span>
                      <strong>รับผ้าเข้าร้าน</strong>
                      <small>เพิ่มรายการรับผ้าใหม่</small>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMenu('สถานะงานซักรีด')}
                    >
                      <span>📋</span>
                      <strong>อัปเดตสถานะ</strong>
                      <small>ตรวจสอบงานซักรีด</small>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMenu('รับชำระเงิน')}
                    >
                      <span>฿</span>
                      <strong>รับชำระเงิน</strong>
                      <small>บันทึกการชำระเงิน</small>
                    </button>
                  </div>
                </article>

                <article className="dashboard-panel">
                  <h2>สถานะงานซักรีด</h2>
                  <p>ภาพรวมรายการในระบบ</p>
                  {['รับผ้าแล้ว', 'กำลังดำเนินการ', 'เสร็จแล้ว'].map(
                    (status, index) => (
                      <div className="status-row" key={status}>
                        <span
                          className={`status-dot ${
                            ['received', 'processing', 'completed'][index]
                          }`}
                        />
                        <span>{status}</span>
                        <strong>0</strong>
                      </div>
                    ),
                  )}
                </article>
              </section>
            </>
          ) : activeMenu === 'จัดการรายการรับผ้า' ? (
            <section className="dashboard-panel laundry-form-panel">
              <div className="laundry-form-heading">
                <div>
                  <h2>รับผ้าเข้าร้าน</h2>
                  <p>กรอกข้อมูลลูกค้าและรายการผ้าที่นำมาซักรีด</p>
                </div>
                <span className="laundry-form-icon">🧺</span>
              </div>

              {orderMessage && (
                <div className="laundry-message success">{orderMessage}</div>
              )}
              {orderError && (
                <div className="laundry-message error">{orderError}</div>
              )}

              <div className="customer-form-section">
                <div className="laundry-section-title">
                  <h3>ข้อมูลลูกค้า</h3>
                  <button
                    type="button"
                    className="secondary-form-button"
                    onClick={() => {
                      setShowNewCustomer(!showNewCustomer)
                      setOrderError('')
                    }}
                  >
                    {showNewCustomer ? 'ยกเลิก' : '+ เพิ่มลูกค้าใหม่'}
                  </button>
                </div>

                {showNewCustomer ? (
                  <form
                    className="laundry-form-grid"
                    onSubmit={handleCreateCustomer}
                  >
                    <div className="laundry-field">
                      <label htmlFor="new-customer-name">ชื่อลูกค้า *</label>
                      <input
                        id="new-customer-name"
                        value={newCustomerName}
                        onChange={(event) =>
                          setNewCustomerName(event.target.value)
                        }
                        placeholder="กรอกชื่อลูกค้า"
                        required
                      />
                    </div>
                    <div className="laundry-field">
                      <label htmlFor="new-customer-phone">เบอร์โทรศัพท์</label>
                      <input
                        id="new-customer-phone"
                        value={newCustomerPhone}
                        onChange={(event) =>
                          setNewCustomerPhone(event.target.value)
                        }
                        placeholder="กรอกเบอร์โทรศัพท์"
                      />
                    </div>
                    <div className="laundry-form-actions">
                      <button type="submit" disabled={savingCustomer}>
                        {savingCustomer ? 'กำลังบันทึก...' : 'บันทึกลูกค้า'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="laundry-field">
                    <label htmlFor="customer-select">เลือกลูกค้า *</label>
                    <select
                      id="customer-select"
                      value={customerId}
                      onChange={(event) => setCustomerId(event.target.value)}
                      disabled={customersLoading}
                    >
                      <option value="">
                        {customersLoading
                          ? 'กำลังโหลดรายชื่อลูกค้า...'
                          : 'เลือกลูกค้า'}
                      </option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                          {customer.phone ? ` (${customer.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <form onSubmit={handleCreateOrder}>
                <div className="laundry-section-title">
                  <h3>รายการผ้า</h3>
                  <button
                    type="button"
                    className="secondary-form-button"
                    onClick={() =>
                      setItems((current) => [...current, emptyItem()])
                    }
                  >
                    + เพิ่มประเภทผ้า
                  </button>
                </div>

                <div className="laundry-items-list">
                  {items.map((item, index) => (
                    <div className="laundry-item-row" key={index}>
                      <div className="laundry-field">
                        <label htmlFor={`item-type-${index}`}>ประเภทผ้า</label>
                        <select
                          id={`item-type-${index}`}
                          value={item.item_type}
                          onChange={(event) =>
                            updateItem(index, 'item_type', event.target.value)
                          }
                        >
                          {clothingTypes.map((type) => (
                            <option key={type.name} value={type.name}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="laundry-field">
                        <label htmlFor={`item-quantity-${index}`}>
                          จำนวน (ชิ้น)
                        </label>
                        <input
                          id={`item-quantity-${index}`}
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(index, 'quantity', event.target.value)
                          }
                          required
                        />
                      </div>

                      <div className="laundry-field">
                        <label htmlFor={`item-price-${index}`}>
                          ราคาต่อชิ้น (บาท)
                        </label>
                        <input
                          id={`item-price-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(event) =>
                            updateItem(index, 'unit_price', event.target.value)
                          }
                          required
                        />
                      </div>

                      <div className="laundry-item-subtotal">
                        <span>รวม</span>
                        <strong>
                          ฿
                          {(
                            Number(item.quantity || 0) *
                            Number(item.unit_price || 0)
                          ).toFixed(2)}
                        </strong>
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          className="remove-item-button"
                          aria-label={`ลบรายการผ้าที่ ${index + 1}`}
                          onClick={() =>
                            setItems((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                        >
                          ลบ
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="laundry-form-grid laundry-order-details">
                  <div className="laundry-field">
                    <label htmlFor="pickup-date">วันนัดรับผ้า *</label>
                    <input
                      id="pickup-date"
                      type="date"
                      value={pickupDate}
                      min={new Date().toLocaleDateString('en-CA')}
                      onChange={(event) => setPickupDate(event.target.value)}
                      required
                    />
                  </div>

                  <div className="laundry-field">
                    <label htmlFor="order-notes">หมายเหตุ</label>
                    <input
                      id="order-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="เช่น รับผ้าช่วงบ่าย"
                    />
                  </div>
                </div>

                <div className="laundry-total">
                  <span>ยอดรวมทั้งหมด</span>
                  <strong>฿{totalAmount.toFixed(2)}</strong>
                </div>

                <div className="laundry-form-actions">
                  <button
                    type="submit"
                    disabled={savingOrder || showNewCustomer}
                  >
                    {savingOrder ? 'กำลังบันทึกรายการ...' : 'บันทึกรายการรับผ้า'}
                  </button>
                </div>
              </form>
            </section>
          ) : activeMenu === 'สถานะงานซักรีด' ? (
            <section className="dashboard-panel laundry-status-panel">
              <div className="laundry-form-heading">
                <div>
                  <h2>รายการงานซักรีด</h2>
                  <p>ตรวจสอบและอัปเดตสถานะงาน โดยบันทึกลงฐานข้อมูลจริง</p>
                </div>
                <button
                  type="button"
                  className="secondary-form-button"
                  onClick={loadOrders}
                  disabled={ordersLoading}
                >
                  {ordersLoading ? 'กำลังโหลด...' : 'รีเฟรช'}
                </button>
              </div>

              {ordersError && <div className="laundry-message error">{ordersError}</div>}

              {ordersLoading ? (
                <p>กำลังโหลดรายการซักรีด...</p>
              ) : orders.length === 0 ? (
                <p>ยังไม่มีรายการรับผ้า</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
                    <thead>
                      <tr>
                        {['เลขที่รายการ', 'ลูกค้า', 'วันนัดรับ', 'ยอดรวม', 'สถานะงาน', 'เปลี่ยนสถานะ'].map((label) => (
                          <th key={label} style={{ textAlign: 'left', padding: '12px 8px', borderBottom: '1px solid #eadde5', whiteSpace: 'nowrap' }}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.order_id}>
                          <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1e7ed' }}>#{order.order_id}</td>
                          <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1e7ed' }}>
                            <strong>{order.customer_name}</strong>
                            <div style={{ fontSize: '0.85em', opacity: 0.7 }}>{order.phone || 'ไม่มีเบอร์โทร'}</div>
                          </td>
                          <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1e7ed', whiteSpace: 'nowrap' }}>{order.pickup_date}</td>
                          <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1e7ed', whiteSpace: 'nowrap' }}>฿{Number(order.total_amount).toFixed(2)}</td>
                          <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1e7ed', whiteSpace: 'nowrap' }}>
                            {({ received: '🧺 รับผ้าแล้ว', processing: '🫧 กำลังดำเนินการ', completed: '✨ เสร็จแล้ว' })[order.status] || order.status}
                          </td>
                          <td style={{ padding: '12px 8px', borderBottom: '1px solid #f1e7ed', minWidth: '190px' }}>
                            <select
                              value={order.status}
                              disabled={updatingOrderId === order.order_id}
                              onChange={(event) => updateOrderStatus(order.order_id, event.target.value)}
                              aria-label={`เปลี่ยนสถานะรายการ ${order.order_id}`}
                            >
                              <option value="received">รับผ้าแล้ว</option>
                              <option value="processing">กำลังดำเนินการ</option>
                              <option value="completed">เสร็จแล้ว</option>
                            </select>
                            {updatingOrderId === order.order_id && <small> กำลังบันทึก...</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            <section className="dashboard-panel menu-placeholder">
              <div className="placeholder-icon">🧺</div>
              <h2>{activeMenu}</h2>
              <p>
                หน้านี้เตรียมไว้สำหรับพัฒนาฟังก์ชัน {activeMenu}
                ในขั้นตอนถัดไป
              </p>
              <button
                type="button"
                className="back-home-button"
                onClick={() => setActiveMenu('หน้าหลัก')}
              >
                กลับหน้าหลัก
              </button>
            </section>
          )}
        </section>
      </main>
    )
  }

    return (
    <main className="login-page">
      <div className="bubble bubble-one" />
      <div className="bubble bubble-two" />
      <div className="bubble bubble-three" />

      <section className="login-card">
        <div className="washer">
          <div className="washer-top">
            <span />
            <span />
            <span />
          </div>
          <div className="washer-door">
            <div className="washer-water" />
          </div>
        </div>

        <p className="brand-label">FRESH &amp; FOLD</p>
        <h1>Welcome Back</h1>
        <p className="subtitle">Your laundry, taken care of.</p>

        <form onSubmit={handleLogin}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            disabled={loading}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
            {!loading && <span>→</span>}
          </button>
        </form>

        <div className="demo-credentials">
          <strong>Demo Account for Instructor</strong>
          <p>Username: <code>Nar</code></p>
          <p>Password: <code>1234</code></p>
          <small>For demonstration purposes only</small>
        </div>

        <div className="login-footer">
          <span>✦</span>
          Clean clothes, happy days
          <span>✦</span>
        </div>
      </section>
    </main>
  )
}

export default App