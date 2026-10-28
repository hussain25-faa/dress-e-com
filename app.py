import json
import os
import re
import sqlite3
import uuid

from flask import Flask, g, jsonify, render_template, request

BASE = os.path.dirname(os.path.abspath(__file__))

# Detect Vercel even if its environment variable is unavailable.
IS_VERCEL = (
    bool(os.environ.get("VERCEL"))
    or BASE.startswith("/var/task")
    or bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
)

if IS_VERCEL:
    # Temporary, writable storage for demo purposes only.
    DB_PATH = "/tmp/saaya_demo.db"
else:
    DB_PATH = os.environ.get(
        "DB_PATH",
        os.path.join(BASE, "zaaya.db")
    )

SHIP_FREE, SHIP_FEE = 2999, 99

app = Flask(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
    price INTEGER NOT NULL, mrp INTEGER NOT NULL, fabric TEXT, description TEXT,
    sizes TEXT NOT NULL, rating REAL DEFAULT 4.5, reviews INTEGER DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 10, tag TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, pincode TEXT,
    address TEXT, payment TEXT, items TEXT NOT NULL, total INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'Order Placed');
"""

ALPHA = ["XS", "S", "M", "L", "XL", "XXL"]
FREE = ["Free Size"]
# id, name, category, price, mrp, fabric, description, sizes, rating, reviews, stock, tag
SEED = [
    ("kundan-anarkali", "Kundan Anarkali Kurta Set · Maroon", "Kurtas", 3499, 5299, "Georgette with silk lining",
     "A flowing anarkali in deep maroon with hand-set kundan work at the neckline. Includes churidar and dupatta.", ALPHA, 4.6, 214, 12, "Bestseller"),
    ("banarasi-saree", "Banarasi Silk Saree · Ruby", "Sarees", 4999, 8999, "Pure katan silk",
     "Woven zari border and a contrast pallu in ruby red. Comes with an unstitched blouse piece.", FREE, 4.8, 96, 8, "New"),
    ("bridal-lehenga", "Embroidered Lehenga · Emerald", "Lehengas", 14999, 22999, "Net with velvet blouse",
     "Dense zardozi and thread embroidery on emerald net. Semi-stitched with adjustable waist.", ["S", "M", "L"], 4.7, 58, 4, "Festive"),
    ("chikankari-kurta", "Lucknowi Chikankari Kurta · Ivory", "Kurtas", 1899, 2999, "Pure cotton",
     "Hand-embroidered chikankari on breathable cotton. Everyday elegance with a festive finish.", ["S", "M", "L", "XL"], 4.5, 402, 20, "Bestseller"),
    ("sequin-gown", "Sequin Evening Gown · Midnight", "Gowns", 6499, 9499, "Crepe with sequin overlay",
     "A floor-length column gown with a fitted bodice and a soft back slit.", ["XS", "S", "M", "L"], 4.4, 37, 6, ""),
    ("linen-coord", "Linen Co-ord Set · Sage", "Co-ords", 2599, 3999, "Breathable linen",
     "Relaxed shirt and wide-leg trouser set in sage linen. Easy to dress up or down.", ALPHA, 4.3, 129, 15, "New"),
    ("mustard-sharara", "Mirror Work Sharara Set · Mustard", "Kurtas", 2799, 3999, "Rayon with mirror work",
     "Mustard kurta with mirror and thread work, paired with a flared sharara and dupatta.", ["S", "M", "L"], 4.2, 77, 9, "Trending"),
    ("blush-satin-maxi", "Silk Satin Maxi Dress · Blush", "Gowns", 3899, 5499, "Satin",
     "Bias-cut blush satin maxi with delicate straps. Ideal for receptions and cocktail evenings.", ["XS", "S", "M", "L"], 4.6, 61, 10, "Sale"),
]


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(SCHEMA)
        # Safe migration for existing customer databases created before order tracking.
        cols = {row[1] for row in conn.execute("PRAGMA table_info(orders)")}
        if "status" not in cols:
            conn.execute("ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'Order Placed'")
        conn.executemany(
            "INSERT OR IGNORE INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            [(i, n, c, p, m, f, d, json.dumps(s), r, v, st, t) for i, n, c, p, m, f, d, s, r, v, st, t in SEED],
        )


def serialize(row):
    item = dict(row)
    item["sizes"] = json.loads(item["sizes"])
    return item


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/products")
def products():
    rows = get_db().execute("SELECT * FROM products ORDER BY reviews DESC").fetchall()
    return jsonify([serialize(r) for r in rows])


@app.post("/api/checkout")
def checkout():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    phone = re.sub(r"\D", "", d.get("phone") or "")
    pin = re.sub(r"\D", "", d.get("pincode") or "")
    address = (d.get("address") or "").strip()
    email = (d.get("email") or "").strip()
    payment = d.get("payment")
    items = d.get("items") or []

    errors = []
    if len(name) < 2: errors.append("Enter your full name.")
    if len(phone) != 10: errors.append("Enter a valid 10-digit mobile number.")
    if len(pin) != 6: errors.append("Enter a valid 6-digit pincode.")
    if len(address) < 10: errors.append("Enter a complete address.")
    if payment not in ("cod", "upi"): errors.append("Choose a payment method.")
    if not items: errors.append("Your bag is empty.")
    if errors:
        return jsonify(error=" ".join(errors)), 400

    db = get_db()
    lines, subtotal = [], 0
    try:
        db.execute("BEGIN IMMEDIATE")  # lock so stock can't be oversold
        for line in items:
            qty = int(line.get("qty") or 0)
            row = db.execute("SELECT * FROM products WHERE id = ?", (line.get("id"),)).fetchone()
            if row is None or qty < 1 or line.get("size") not in json.loads(row["sizes"]):
                db.rollback()
                return jsonify(error="One of the items in your bag is no longer valid."), 409
            if row["stock"] < qty:
                db.rollback()
                return jsonify(error=f"Only {row['stock']} left of {row['name']}."), 409
            db.execute("UPDATE products SET stock = stock - ? WHERE id = ?", (qty, row["id"]))
            subtotal += row["price"] * qty
            lines.append({"id": row["id"], "name": row["name"], "size": line["size"], "qty": qty, "price": row["price"]})
        shipping = 0 if subtotal >= SHIP_FREE else SHIP_FEE
        total = subtotal + shipping
        order_id = "SY" + uuid.uuid4().hex[:8].upper()
        db.execute(
            "INSERT INTO orders (id, name, phone, email, pincode, address, payment, items, total) VALUES (?,?,?,?,?,?,?,?,?)",
            (order_id, name, phone, email, pin, address, payment, json.dumps(lines), total),
        )
        db.commit()
    except (sqlite3.Error, ValueError, TypeError, KeyError):
        db.rollback()
        return jsonify(error="Checkout failed. Please try again."), 500
    return jsonify(order_id=order_id, total=total), 201


@app.post("/api/profile")
def profile():
    """MVP order lookup by checkout phone, optionally narrowed by email.

    For public production use, protect this endpoint with OTP or account authentication.
    """
    d = request.get_json(silent=True) or {}
    phone = re.sub(r"\D", "", d.get("phone") or "")
    email = (d.get("email") or "").strip().lower()
    if len(phone) != 10:
        return jsonify(error="Enter the 10-digit mobile number used at checkout."), 400
    sql = "SELECT * FROM orders WHERE phone = ?"
    args = [phone]
    if email:
        sql += " AND lower(COALESCE(email, '')) = ?"
        args.append(email)
    sql += " ORDER BY created_at DESC LIMIT 50"
    rows = get_db().execute(sql, args).fetchall()
    orders = []
    latest = None
    for row in rows:
        item = dict(row)
        item["items"] = json.loads(item["items"])
        orders.append(item)
        if latest is None:
            latest = {"name": item.get("name"), "phone": item.get("phone"), "email": item.get("email"),
                      "address": item.get("address"), "pincode": item.get("pincode")}
    return jsonify(profile=latest, orders=orders)


init_db()

if __name__ == "__main__":
    app.run(debug=True)
