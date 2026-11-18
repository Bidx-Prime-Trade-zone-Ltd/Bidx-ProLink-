// Initial English-language launch markets for Pedes Prolink.
// ISO 3166-1 alpha-2/alpha-3 codes are used for location data and payment routing.
export const INITIAL_COUNTRIES = [
  ["NG","NGA","Nigeria"],["GH","GHA","Ghana"],["KE","KEN","Kenya"],["UG","UGA","Uganda"],
  ["TZ","TZA","Tanzania"],["RW","RWA","Rwanda"],["ZA","ZAF","South Africa"],["ZM","ZMB","Zambia"],
  ["ZW","ZWE","Zimbabwe"],["BW","BWA","Botswana"],["NA","NAM","Namibia"],["MW","MWI","Malawi"],
  ["SL","SLE","Sierra Leone"],["LR","LBR","Liberia"],["GM","GMB","The Gambia"],["LS","LSO","Lesotho"],
  ["SZ","SWZ","Eswatini"],["MU","MUS","Mauritius"],["SC","SYC","Seychelles"],["CM","CMR","Cameroon"],
  ["SS","SSD","South Sudan"],
  ["GB","GBR","United Kingdom"],["IE","IRL","Ireland"],["MT","MLT","Malta"],
  ["US","USA","United States"],["CA","CAN","Canada"],["JM","JAM","Jamaica"],["TT","TTO","Trinidad and Tobago"],
  ["BB","BRB","Barbados"],["BS","BHS","Bahamas"],["BZ","BLZ","Belize"],["GY","GUY","Guyana"],
  ["LC","LCA","Saint Lucia"],["GD","GRD","Grenada"],["DM","DMA","Dominica"],["AG","ATG","Antigua and Barbuda"],
  ["KN","KNA","Saint Kitts and Nevis"],["VC","VCT","Saint Vincent and the Grenadines"],
  ["AU","AUS","Australia"],["NZ","NZL","New Zealand"],["SG","SGP","Singapore"],["PH","PHL","Philippines"],
  ["IN","IND","India"],["PK","PAK","Pakistan"],["BD","BGD","Bangladesh"],
  ["FJ","FJI","Fiji"],["PG","PNG","Papua New Guinea"],["SB","SLB","Solomon Islands"],
  ["VU","VUT","Vanuatu"],["WS","WSM","Samoa"],["TO","TON","Tonga"],["KI","KIR","Kiribati"],
  ["MH","MHL","Marshall Islands"],["FM","FSM","Micronesia"],["PW","PLW","Palau"],["NR","NRU","Nauru"],
  ["TV","TUV","Tuvalu"]
].map(([code, iso3, name]) => ({ code, iso3, name, language: "en" }));

export const COUNTRY_BY_CODE = Object.fromEntries(INITIAL_COUNTRIES.map(country => [country.code, country]));
