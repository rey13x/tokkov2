const chalk = require("chalk")
const fs = require("fs")


// DATA OWNER / ADMIN 
  global.ownerNumber = "6285791220179@s.whatsapp.net"  // Nomor WA owner (format: 62xxx@s.whatsapp.net) ” JANGAN hapus "@s.whatsapp.net"
  global.kontakOwner = "6285791220179"                  
  global.ownerName   = "Nama mu"                        
  global.namaStore = "Nama store mu"  
  global.botName   = "Nama bot mu"    


  global.apikeyRama = "Apikeymu"
  // Cara mendapatkan API Key:
  //  1. Buka browser, kunjungi https://ramashop.my.id
  //  2. Daftar / Login menggunakan akun kamu
  //  3. Masuk ke menu "API Key" atau "Profil"
  //  4. Salin API Key kamu, lalu tempel di sini (ganti tulisan "Apikeymu")


//==================TIDAK PERLU DI EDIT=========================
let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.redBright(`Update'${__filename}'`))
	delete require.cache[file]
	require(file)
})
