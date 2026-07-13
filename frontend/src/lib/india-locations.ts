// Comprehensive India States and Districts Data
// Source: Official government district data

export interface IndiaState {
  name: string;
  code: string;
  districts: string[];
}

export const INDIA_STATES: IndiaState[] = [
  {
    name: "Andhra Pradesh",
    code: "AP",
    districts: [
      "Alluri Sitharama Raju", "Anakapalli", "Ananthapuramu", "Annamayya", "Bapatla",
      "Chittoor", "East Godavari", "Eluru", "Guntur", "Kakinada", "Konaseema",
      "Krishna", "Kurnool", "Manyam", "NTR", "Nandyal", "Nellore", "Palnadu",
      "Prakasam", "Sri Balaji", "Sri Sathya Sai", "Srikakulam", "Visakhapatnam",
      "Vizianagaram", "West Godavari", "YSR Kadapa"
    ]
  },
  {
    name: "Arunachal Pradesh",
    code: "AR",
    districts: [
      "Anjaw", "Changlang", "Dibang Valley", "East Kameng", "East Siang",
      "Itanagar Capital Complex", "Kamle", "Kra Daadi", "Kurung Kumey", "Leparada",
      "Lohit", "Longding", "Lower Dibang Valley", "Lower Siang", "Lower Subansiri",
      "Namsai", "Pakke-Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang",
      "Tirap", "Upper Dibang Valley", "Upper Siang", "Upper Subansiri", "West Kameng",
      "West Siang"
    ]
  },
  {
    name: "Assam",
    code: "AS",
    districts: [
      "Bajali", "Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar",
      "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh",
      "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat",
      "Kamrup", "Kamrup Metropolitan", "Karbi Anglong", "Karimganj", "Kokrajhar",
      "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar",
      "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"
    ]
  },
  {
    name: "Bihar",
    code: "BR",
    districts: [
      "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur",
      "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj",
      "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj",
      "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda",
      "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran",
      "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali",
      "West Champaran"
    ]
  },
  {
    name: "Chhattisgarh",
    code: "CG",
    districts: [
      "Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur",
      "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Gaurella-Pendra-Marwahi",
      "Janjgir-Champa", "Jashpur", "Kabirdham", "Kanker", "Khairagarh", "Kondagaon",
      "Korba", "Koriya", "Mahasamund", "Manendragarh", "Mohla-Manpur", "Mungeli",
      "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sakti", "Sarangarh-Bilaigarh",
      "Sukma", "Surajpur", "Surguja"
    ]
  },
  {
    name: "Goa",
    code: "GA",
    districts: ["North Goa", "South Goa"]
  },
  {
    name: "Gujarat",
    code: "GJ",
    districts: [
      "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch",
      "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka",
      "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch",
      "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal",
      "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar",
      "Tapi", "Vadodara", "Valsad"
    ]
  },
  {
    name: "Haryana",
    code: "HR",
    districts: [
      "Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram",
      "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh",
      "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa",
      "Sonipat", "Yamunanagar"
    ]
  },
  {
    name: "Himachal Pradesh",
    code: "HP",
    districts: [
      "Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul And Spiti",
      "Mandi", "Shimla", "Sirmaur", "Solan", "Una"
    ]
  },
  {
    name: "Jharkhand",
    code: "JH",
    districts: [
      "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum",
      "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti",
      "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi",
      "Sahebganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum"
    ]
  },
  {
    name: "Karnataka",
    code: "KA",
    districts: [
      "Bagalkote", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban",
      "Bidar", "Chamarajanagar", "Chikkaballapura", "Chikkamagaluru", "Chitradurga",
      "Dakshina Kannada", "Davangere", "Dharwad", "Gadag", "Hassan", "Haveri",
      "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur",
      "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayanagara",
      "Vijayapura", "Yadgir"
    ]
  },
  {
    name: "Kerala",
    code: "KL",
    districts: [
      "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam",
      "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta",
      "Thiruvananthapuram", "Thrissur", "Wayanad"
    ]
  },
  {
    name: "Madhya Pradesh",
    code: "MP",
    districts: [
      "Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani",
      "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara",
      "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior",
      "Harda", "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni",
      "Khandwa", "Khargone", "Maihar", "Mandla", "Mandsaur", "Morena",
      "Narsinghpur", "Neemuch", "Niwari", "Panna", "Raisen", "Rajgarh",
      "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol",
      "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh",
      "Ujjain", "Umaria", "Vidisha"
    ]
  },
  {
    name: "Maharashtra",
    code: "MH",
    districts: [
      "Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara",
      "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli",
      "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban",
      "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar",
      "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg",
      "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"
    ]
  },
  {
    name: "Manipur",
    code: "MN",
    districts: [
      "Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West",
      "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl",
      "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"
    ]
  },
  {
    name: "Meghalaya",
    code: "ML",
    districts: [
      "East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "Eastern West Khasi Hills",
      "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills",
      "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"
    ]
  },
  {
    name: "Mizoram",
    code: "MZ",
    districts: [
      "Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai",
      "Lunglei", "Mamit", "Saiha", "Saitual", "Serchhip"
    ]
  },
  {
    name: "Nagaland",
    code: "NL",
    districts: [
      "Chumoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung",
      "Mon", "Niuland", "Noklak", "Peren", "Phek", "Shamator", "Tseminyu",
      "Tuensang", "Wokha", "Zunheboto"
    ]
  },
  {
    name: "Odisha",
    code: "OD",
    districts: [
      "Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh",
      "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur",
      "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar",
      "Khorda", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh",
      "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"
    ]
  },
  {
    name: "Punjab",
    code: "PB",
    districts: [
      "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka",
      "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana",
      "Malerkotla", "Mansa", "Moga", "Mohali", "Muktsar", "Pathankot", "Patiala",
      "Rupnagar", "Sangrur", "Shaheed Bhagat Singh Nagar", "Tarn Taran"
    ]
  },
  {
    name: "Rajasthan",
    code: "RJ",
    districts: [
      "Ajmer", "Alwar", "Anupgarh", "Balotra", "Banswara", "Baran", "Barmer",
      "Beawar", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh",
      "Churu", "Dausa", "Deeg", "Dholpur", "Didwana-Kuchaman", "Dudu",
      "Dungarpur", "Ganganagar", "Gangapurcity", "Hanumangarh", "Jaipur",
      "Jaipur Rural", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur",
      "Jodhpur Rural", "Karauli", "Kekri", "Khairthal-Tijara", "Kotputli-Behror",
      "Kota", "Nagaur", "Neem Ka Thana", "Pali", "Phalodi", "Pratapgarh",
      "Rajsamand", "Salumbar", "Sanchore", "Sawai Madhopur", "Shahpura",
      "Sikar", "Sirohi", "Tonk", "Udaipur"
    ]
  },
  {
    name: "Sikkim",
    code: "SK",
    districts: ["East Sikkim", "North Sikkim", "Pakyong", "Soreng", "South Sikkim", "West Sikkim"]
  },
  {
    name: "Tamil Nadu",
    code: "TN",
    districts: [
      "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri",
      "Dindigul", "Erode", "Kallakurichi", "Kancheepuram", "Kanyakumari", "Karur",
      "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal",
      "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet",
      "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi",
      "Tiruchirappalli", "Tirunelveli", "Tirupattur", "Tiruppur", "Tiruvallur",
      "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"
    ]
  },
  {
    name: "Telangana",
    code: "TS",
    districts: [
      "Adilabad", "Bhadradri Kothagudem", "Hanumakonda", "Hyderabad", "Jagtial",
      "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy",
      "Karimnagar", "Khammam", "Kumuram Bheem Asifabad", "Mahabubabad",
      "Mahabubnagar", "Mancherial", "Medak", "Medchal–Malkajgiri", "Mulugu",
      "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad",
      "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet",
      "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"
    ]
  },
  {
    name: "Tripura",
    code: "TR",
    districts: [
      "Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura",
      "Unakoti", "West Tripura"
    ]
  },
  {
    name: "Uttar Pradesh",
    code: "UP",
    districts: [
      "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya",
      "Ayodhya", "Azamgarh", "Badaun", "Baghpat", "Bahraich", "Ballia",
      "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bijnor",
      "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah",
      "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad",
      "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi",
      "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat",
      "Kanpur Nagar", "Kasganj", "Kaushambi", "Kushinagar", "Lakhimpur Kheri",
      "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura",
      "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit",
      "Pratapgarh", "Prayagraj", "Rae Bareli", "Rampur", "Saharanpur",
      "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti",
      "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao",
      "Varanasi"
    ]
  },
  {
    name: "Uttarakhand",
    code: "UK",
    districts: [
      "Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar",
      "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal",
      "Udham Singh Nagar", "Uttarkashi"
    ]
  },
  {
    name: "West Bengal",
    code: "WB",
    districts: [
      "Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur",
      "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong",
      "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas",
      "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur",
      "Purulia", "South 24 Parganas", "Uttar Dinajpur"
    ]
  },
  // Union Territories
  {
    name: "Andaman & Nicobar Islands",
    code: "AN",
    districts: ["Nicobar", "North & Middle Andaman", "South Andaman"]
  },
  {
    name: "Chandigarh",
    code: "CH",
    districts: ["Chandigarh"]
  },
  {
    name: "Dadra & Nagar Haveli and Daman & Diu",
    code: "DD",
    districts: ["Dadra And Nagar Haveli", "Daman", "Diu"]
  },
  {
    name: "Delhi",
    code: "DL",
    districts: [
      "Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi",
      "North West Delhi", "Shahdara", "South Delhi", "South East Delhi",
      "South West Delhi", "West Delhi"
    ]
  },
  {
    name: "Jammu & Kashmir",
    code: "JK",
    districts: [
      "Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal",
      "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama",
      "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"
    ]
  },
  {
    name: "Ladakh",
    code: "LA",
    districts: ["Kargil", "Leh"]
  },
  {
    name: "Lakshadweep",
    code: "LD",
    districts: ["Lakshadweep"]
  },
  {
    name: "Puducherry",
    code: "PY",
    districts: ["Karaikal", "Mahe", "Puducherry", "Yanam"]
  }
];

// Helper: Get districts for a given state name
export function getDistrictsForState(stateName: string): string[] {
  const state = INDIA_STATES.find(s => s.name === stateName);
  return state ? state.districts.sort() : [];
}

// Helper: Get all state names
export function getStateNames(): string[] {
  return INDIA_STATES.map(s => s.name).sort();
}

// Helper: Validate state + district combo
export function isValidLocation(state: string, district: string): boolean {
  const districts = getDistrictsForState(state);
  return districts.includes(district);
}
