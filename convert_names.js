/**
 * convert_names.js
 *
 * Generates a names_master.csv file from a JS-like raw names file (names_raw.txt).
 * Usage: place names_raw.txt in the same directory and run: node convert_names.js
 */

const fs = require("fs")

/**
 * processNames
 *
 * Reads names_raw.txt, converts it into a temporary JS module, loads the data,
 * maps country names to ISO-like codes (fallback = first 2 letters), and writes
 * a CSV file names_master.csv with columns:
 *   country_code,first_name,last_name,gender
 */
function processNames() {
  // Read your raw file
  let raw = fs.readFileSync('names_raw.txt', 'utf8')

  // Turn JS-like object into real JS object
  raw = 'const data = {' + raw + '};'
  fs.writeFileSync('temp_data.js', raw)

  // Load it
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { data } = require('./temp_data')

  // Map country names to codes (fallback = first 2 letters)
  const countryCodes = {
    Germany: 'DE',
    France: 'FR',
    Italy: 'IT',
    Spain: 'ES',
    Poland: 'PL',
    Netherlands: 'NL',
    Belgium: 'BE',
    Portugal: 'PT',
    Greece: 'GR',
    Sweden: 'SE',
    Hungary: 'HU',
    Armenia: 'AM',
    Cyprus: 'CY',
    Israel: 'IL',
    Slovakia: 'SK',
    Romania: 'RO',
    Bulgaria: 'BG',
    Croatia: 'HR',
    Serbia: 'RS',
    Ukraine: 'UA',
    Albania: 'AL',
    Austria: 'AT',
    Belarus: 'BY',
    'Bosnia and Herzegovina': 'BA',
    'Czech Republic': 'CZ',
    Denmark: 'DK',
    Estonia: 'EE',
    Finland: 'FI',
    Ireland: 'IE',
    Kosovo: 'XK',
    Latvia: 'LV',
    Lithuania: 'LT',
    Luxembourg: 'LU',
    Moldova: 'MD',
    Montenegro: 'ME',
    'North Macedonia': 'MK',
    Norway: 'NO',
    Slovenia: 'SI',
    Switzerland: 'CH',
    'United Kingdom': 'GB',
    Bahrain: 'BH',
    Georgia: 'GE',
    Iran: 'IR',
    Iraq: 'IQ',
    Jordan: 'JO',
    Lebanon: 'LB',
    Oman: 'OM',
    Syria: 'SY',
    Turkey: 'TR',
    Yemen: 'YE',
    Kazakhstan: 'KZ',
    Kyrgyzstan: 'KG',
    Tajikistan: 'TJ',
    Turkmenistan: 'TM',
    Uzbekistan: 'UZ',
    Afghanistan: 'AF',
    Bangladesh: 'BD',
    India: 'IN',
    Pakistan: 'PK',
    'Sri Lanka': 'LK',
    China: 'CN',
    'South Korea': 'KR',
    Cambodia: 'KH',
    Indonesia: 'ID',
    Malaysia: 'MY',
  }

  // Output CSV
  let out = []
  out.push('country_code,first_name,last_name,gender')

  for (const [country, sets] of Object.entries(data)) {
    const code = countryCodes[country] || country.slice(0, 2).toUpperCase()
    const lasts = sets.last

    // Male names
    for (const first of sets.male) {
      for (let i = 0; i < 5; i++) {
        const last = lasts[Math.floor(Math.random() * lasts.length)]
        out.push(`${code},${first},${last},male`)
      }
    }

    // Female names
    for (const first of sets.female) {
      for (let i = 0; i < 5; i++) {
        const last = lasts[Math.floor(Math.random() * lasts.length)]
        out.push(`${code},${first},${last},female`)
      }
    }
  }

  fs.writeFileSync('names_master.csv', out.join('\n'), 'utf8')
  console.log('Created names_master.csv with', out.length - 1, 'rows')
}

// Execute
processNames()