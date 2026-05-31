const fs = require('fs');
const path = require('path');

const sessionPath = path.join(__dirname, '../database/sessions.json');

function readSession() {
    if (!fs.existsSync(sessionPath)) return {};
    return JSON.parse(fs.readFileSync(sessionPath));
}

function saveSession(data) {
    fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2));
}

function setSession(user, data) {
    const sessions = readSession();
    sessions[user] = data;
    saveSession(sessions);
}

function getSession(user) {
    const sessions = readSession();
    return sessions[user] || null;
}

function clearSession(user) {
    const sessions = readSession();
    delete sessions[user];
    saveSession(sessions);
}

module.exports = {
    setSession,
    getSession,
    clearSession
};