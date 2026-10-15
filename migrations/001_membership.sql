BEGIN;

-- แผนแพ็กเกจสมาชิก
CREATE TABLE IF NOT EXISTS membership_plans (
    plan_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    piece_limit INTEGER NOT NULL CHECK (piece_limit > 0),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- สมาชิกแต่ละรอบของลูกค้า
CREATE TABLE IF NOT EXISTS memberships (
    membership_id BIGSERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL
        REFERENCES customers(customer_id),
    plan_id INTEGER NOT NULL
        REFERENCES membership_plans(plan_id),
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    initial_pieces INTEGER NOT NULL CHECK (initial_pieces > 0),
    remaining_pieces INTEGER NOT NULL CHECK (
        remaining_pieces >= 0
        AND remaining_pieces <= initial_pieces
    ),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'exhausted')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (expiry_date >= start_date)
);

-- ประวัติการซื้อและการใช้สิทธิ์
CREATE TABLE IF NOT EXISTS membership_transactions (
    transaction_id BIGSERIAL PRIMARY KEY,
    membership_id BIGINT NOT NULL
        REFERENCES memberships(membership_id),
    transaction_type VARCHAR(30) NOT NULL
        CHECK (transaction_type IN (
            'purchase',
            'deduction',
            'excess_charge'
        )),
    pieces INTEGER NOT NULL DEFAULT 0 CHECK (pieces >= 0),
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- เชื่อมออเดอร์กับสิทธิ์ที่ใช้ ป้องกันออเดอร์เดียวถูกตัดซ้ำ
CREATE TABLE IF NOT EXISTS membership_order_usage (
    usage_id BIGSERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE
        REFERENCES laundry_orders(order_id),
    membership_id BIGINT NOT NULL
        REFERENCES memberships(membership_id),
    covered_pieces INTEGER NOT NULL DEFAULT 0
        CHECK (covered_pieces >= 0),
    excess_pieces INTEGER NOT NULL DEFAULT 0
        CHECK (excess_pieces >= 0),
    excess_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
        CHECK (excess_amount >= 0),
    excess_choice VARCHAR(30) NOT NULL
        CHECK (excess_choice IN (
            'charge_excess',
            'new_package'
        )),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memberships_customer
    ON memberships(customer_id);

CREATE INDEX IF NOT EXISTS idx_memberships_expiry
    ON memberships(expiry_date);

CREATE INDEX IF NOT EXISTS idx_membership_transactions_membership
    ON membership_transactions(membership_id);

-- เพิ่มแผนสมาชิกโดยไม่เปลี่ยนรายการแพ็กเกจเดิม
INSERT INTO membership_plans (name, piece_limit, price)
VALUES
    ('สมาชิก 25 ชิ้น', 25, 320.00),
    ('สมาชิก 35 ชิ้น', 35, 410.00),
    ('สมาชิก 60 ชิ้น', 60, 600.00)
ON CONFLICT (name) DO NOTHING;

COMMIT;
