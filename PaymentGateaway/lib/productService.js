const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/products.json');

function readDB() {
    if (!fs.existsSync(dbPath)) return [];
    return JSON.parse(fs.readFileSync(dbPath));
}

function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function sortProducts(products) {
    return products.sort((a, b) => a.name.localeCompare(b.name));
}

function reNumber(products) {
    return products.map((p, i) => ({
        ...p,
        number: i + 1
    }));
}

function getAllProducts() {
    const products = sortProducts(readDB());
    return reNumber(products);
}

function addProduct(id, name, desc, price) {
    let products = readDB();
    products.push({
        id,
        name,
        desc,
        price: Number(price),
        stock: 0
    });

    saveDB(products);
    return true;
}

function addStock(productId, qty) {
    let products = readDB();
    const product = products.find(p => p.id === productId);
    if (!product) return false;

    product.stock += Number(qty);
    saveDB(products);
    return true;
}

function updateProduct(id, field, value) {
    let products = readDB();
    const product = products.find(p => p.id === id);
    if (!product) return false;

    if (field === 'price') value = Number(value);

    product[field] = value;
    saveDB(products);
    return true;
}

function getProductByNumber(number) {
    const products = getAllProducts();
    return products.find(p => p.number === Number(number));
}

function reduceStock(id, qty) {
    let products = readDB();
    const product = products.find(p => p.id === id);
    if (!product) return false;

    product.stock -= Number(qty);
    saveDB(products);
    return true;
}

module.exports = {
    getAllProducts,
    addProduct,
    addStock,
    updateProduct,
    getProductByNumber,
    reduceStock
};