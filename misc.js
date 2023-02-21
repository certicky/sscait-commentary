import wordExists from 'word-exists'
import { spawn } from 'child_process'

// Frequencies of bigrams in English language, according to this paper by Rick Wicklin:
// https://blogs.sas.com/content/iml/2014/09/26/bigrams.html
const bigramFrequencies = { AA: 0.003, BA: 0.146, CA: 0.538, DA: 0.151, EA: 0.688, FA: 0.164, GA: 0.148, HA: 0.926, IA: 0.286, JA: 0.026, KA: 0.017, LA: 0.528, MA: 0.565, NA: 0.347, OA: 0.057, PA: 0.324, QA: 0.0, RA: 0.686, SA: 0.218, TA: 0.53, UA: 0.136, VA: 0.14, WA: 0.385, XA: 0.03, YA: 0.016, ZA: 0.025, AB: 0.23, BB: 0.011, CB: 0.001, DB: 0.003, EB: 0.027, FB: 0.0, GB: 0.0, HB: 0.004, IB: 0.099, JB: 0.0, KB: 0.001, LB: 0.007, MB: 0.09, NB: 0.004, OB: 0.097, PB: 0.001, QB: 0.0, RB: 0.027, SB: 0.008, TB: 0.003, UB: 0.089, VB: 0.0, WB: 0.001, XB: 0.0, YB: 0.004, ZB: 0.000, AC: 0.448, BC: 0.002, CC: 0.083, DC: 0.003, EC: 0.477, FC: 0.001, GC: 0.0, HC: 0.001, IC: 0.699, JC: 0.0, KC: 0.0, LC: 0.012, MC: 0.004, NC: 0.416, OC: 0.166, PC: 0.001, QC: 0.0, RC: 0.121, SC: 0.155, TC: 0.026, UC: 0.188, VC: 0.0, WC: 0.001, XC: 0.026, YC: 0.014, ZC: 0.000, AD: 0.368, BD: 0.002, CD: 0.002, DD: 0.043, ED: 1.168, FD: 0.0, GD: 0.003, HD: 0.003, ID: 0.296, JD: 0.0, KD: 0.001, LD: 0.253, MD: 0.001, ND: 1.352, OD: 0.195, PD: 0.001, QD: 0.0, RD: 0.189, SD: 0.005, TD: 0.001, UD: 0.091, VD: 0.0, WD: 0.004, XD: 0.0, YD: 0.007, ZD: 0.000, AE: 0.012, BE: 0.576, CE: 0.651, DE: 0.765, EE: 0.378, FE: 0.237, GE: 0.385, HE: 3.075, IE: 0.385, JE: 0.052, KE: 0.214, LE: 0.829, ME: 0.793, NE: 0.692, OE: 0.039, PE: 0.478, QE: 0.0, RE: 1.854, SE: 0.932, TE: 1.205, UE: 0.147, VE: 0.825, WE: 0.361, XE: 0.022, YE: 0.093, ZE: 0.050, AF: 0.074, BF: 0.0, CF: 0.001, DF: 0.003, EF: 0.163, FF: 0.146, GF: 0.001, HF: 0.002, IF: 0.203, JF: 0.0, KF: 0.002, LF: 0.053, MF: 0.004, NF: 0.067, OF: 1.175, PF: 0.001, QF: 0.0, RF: 0.032, SF: 0.017, TF: 0.006, UF: 0.019, VF: 0.0, WF: 0.002, XF: 0.002, YF: 0.001, ZF: 0.000, AG: 0.205, BG: 0.0, CG: 0.001, DG: 0.031, EG: 0.12, FG: 0.001, GG: 0.025, HG: 0.0, IG: 0.255, JG: 0.0, KG: 0.003, LG: 0.006, MG: 0.001, NG: 0.953, OG: 0.094, PG: 0.0, QG: 0.0, RG: 0.1, SG: 0.002, TG: 0.002, UG: 0.128, VG: 0.0, WG: 0.0, XG: 0.0, YG: 0.003, ZG: 0.000, AH: 0.014, BH: 0.001, CH: 0.598, DH: 0.005, EH: 0.026, FH: 0.0, GH: 0.228, HH: 0.001, IH: 0.002, JH: 0.0, KH: 0.003, LH: 0.002, MH: 0.001, NH: 0.011, OH: 0.021, PH: 0.094, QH: 0.0, RH: 0.015, SH: 0.315, TH: 3.556, UH: 0.001, VH: 0.0, WH: 0.379, XH: 0.004, YH: 0.001, ZH: 0.001, AI: 0.316, BI: 0.107, CI: 0.281, DI: 0.493, EI: 0.183, FI: 0.285, GI: 0.152, HI: 0.763, II: 0.023, JI: 0.003, KI: 0.098, LI: 0.624, MI: 0.318, NI: 0.339, OI: 0.088, PI: 0.123, QI: 0.0, RI: 0.728, SI: 0.55, TI: 1.343, UI: 0.101, VI: 0.27, WI: 0.374, XI: 0.039, YI: 0.029, ZI: 0.012, AJ: 0.012, BJ: 0.023, CJ: 0.0, DJ: 0.005, EJ: 0.005, FJ: 0.0, GJ: 0.0, HJ: 0.0, IJ: 0.001, JJ: 0.0, KJ: 0.0, LJ: 0.0, MJ: 0.000, NJ: 0.011, OJ: 0.007, PJ: 0.0, QJ: 0.0, RJ: 0.001, SJ: 0.0, TJ: 0.0, UJ: 0.001, VJ: 0.0, WJ: 0.0, XJ: 0.0, YJ: 0.0, ZJ: 0.000, AK: 0.105, BK: 0.0, CK: 0.118, DK: 0.0, EK: 0.016, FK: 0.0, GK: 0.0, HK: 0.0, IK: 0.043, JK: 0.0, KK: 0.0, LK: 0.02, MK: 0.0, NK: 0.052, OK: 0.064, PK: 0.001, QK: 0.0, RK: 0.097, SK: 0.039, TK: 0.0, UK: 0.005, VK: 0.0, WK: 0.001, XK: 0.0, YK: 0.0, ZK: 0.000, AL: 1.087, BL: 0.233, CL: 0.149, DL: 0.032, EL: 0.53, FL: 0.065, GL: 0.061, HL: 0.013, IL: 0.432, JL: 0.0, KL: 0.011, LL: 0.577, ML: 0.005, NL: 0.064, OL: 0.365, PL: 0.263, QL: 0.0, RL: 0.086, SL: 0.056, TL: 0.098, UL: 0.346, VL: 0.0, WL: 0.015, XL: 0.001, YL: 0.015, ZL: 0.001, AM: 0.285, BM: 0.003, CM: 0.003, DM: 0.018, EM: 0.374, FM: 0.001, GM: 0.01, HM: 0.013, IM: 0.318, JM: 0.0, KM: 0.002, LM: 0.023, MM: 0.096, NM: 0.028, OM: 0.546, PM: 0.016, QM: 0.0, RM: 0.175, SM: 0.065, TM: 0.026, UM: 0.138, VM: 0.0, WM: 0.001, XM: 0.0, YM: 0.024, ZM: 0.000, AN: 1.985, BN: 0.002, CN: 0.001, DN: 0.008, EN: 1.454, FN: 0.0, GN: 0.066, HN: 0.026, IN: 2.433, JN: 0.0, KN: 0.051, LN: 0.006, MN: 0.009, NN: 0.073, ON: 1.758, PN: 0.001, QN: 0.0, RN: 0.16, SN: 0.009, TN: 0.01, UN: 0.394, VN: 0.0, WN: 0.079, XN: 0.0, YN: 0.013, ZN: 0.000, AO: 0.005, BO: 0.195, CO: 0.794, DO: 0.188, EO: 0.073, FO: 0.488, GO: 0.132, HO: 0.485, IO: 0.835, JO: 0.054, KO: 0.006, LO: 0.387, MO: 0.337, NO: 0.465, OO: 0.21, PO: 0.361, QO: 0.0, RO: 0.727, SO: 0.398, TO: 1.041, UO: 0.011, VO: 0.071, WO: 0.222, XO: 0.003, YO: 0.15, ZO: 0.007, AP: 0.203, BP: 0.001, CP: 0.001, DP: 0.002, EP: 0.172, FP: 0.0, GP: 0.0, HP: 0.001, IP: 0.089, JP: 0.0, KP: 0.001, LP: 0.019, MP: 0.239, NP: 0.006, OP: 0.224, PP: 0.137, QP: 0.0, RP: 0.042, SP: 0.191, TP: 0.004, UP: 0.136, VP: 0.0, WP: 0.001, XP: 0.067, YP: 0.025, ZP: 0.000, AQ: 0.002, BQ: 0.0, CQ: 0.005, DQ: 0.001, EQ: 0.057, FQ: 0.0, GQ: 0.0, HQ: 0.0, IQ: 0.011, JQ: 0.0, KQ: 0.0, LQ: 0.0, MQ: 0.000, NQ: 0.006, OQ: 0.001, PQ: 0.0, QQ: 0.0, RQ: 0.001, SQ: 0.007, TQ: 0.0, UQ: 0.0, VQ: 0.0, WQ: 0.0, XQ: 0.0, YQ: 0.0, ZQ: 0.000, AR: 1.075, BR: 0.112, CR: 0.149, DR: 0.085, ER: 2.048, FR: 0.213, GR: 0.197, HR: 0.084, IR: 0.315, JR: 0.0, KR: 0.003, LR: 0.01, MR: 0.003, NR: 0.009, OR: 1.277, PR: 0.474, QR: 0.0, RR: 0.121, SR: 0.006, TR: 0.426, UR: 0.543, VR: 0.001, WR: 0.031, XR: 0.0, YR: 0.008, ZR: 0.000, AS: 0.871, BS: 0.046, CS: 0.023, DS: 0.126, ES: 1.339, FS: 0.006, GS: 0.051, HS: 0.015, IS: 1.128, JS: 0.0, KS: 0.048, LS: 0.142, MS: 0.093, NS: 0.509, OS: 0.29, PS: 0.055, QS: 0.0, RS: 0.397, SS: 0.405, TS: 0.337, US: 0.454, VS: 0.001, WS: 0.035, XS: 0.0, YS: 0.097, ZS: 0.000, AT: 1.487, BT: 0.017, CT: 0.461, DT: 0.003, ET: 0.413, FT: 0.082, GT: 0.015, HT: 0.13, IT: 1.123, JT: 0.0, KT: 0.001, LT: 0.124, MT: 0.001, NT: 1.041, OT: 0.442, PT: 0.106, QT: 0.0, RT: 0.362, ST: 1.053, TT: 0.171, UT: 0.405, VT: 0.0, WT: 0.007, XT: 0.047, YT: 0.017, ZT: 0.000, AU: 0.119, BU: 0.185, CU: 0.163, DU: 0.148, EU: 0.031, FU: 0.096, GU: 0.086, HU: 0.074, IU: 0.017, JU: 0.059, KU: 0.003, LU: 0.135, MU: 0.115, NU: 0.079, OU: 0.87, PU: 0.105, QU: 0.148, RU: 0.128, SU: 0.311, TU: 0.255, UU: 0.001, VU: 0.002, WU: 0.001, XU: 0.005, YU: 0.001, ZU: 0.002, AV: 0.205, BV: 0.004, CV: 0.0, DV: 0.019, EV: 0.255, FV: 0.0, GV: 0.0, HV: 0.0, IV: 0.288, JV: 0.0, KV: 0.0, LV: 0.035, MV: 0.000, NV: 0.052, OV: 0.178, PV: 0.0, QV: 0.0, RV: 0.069, SV: 0.001, TV: 0.001, UV: 0.003, VV: 0.0, WV: 0.0, XV: 0.002, YV: 0.0, ZV: 0.000, AW: 0.06, BW: 0.0, CW: 0.0, DW: 0.008, EW: 0.117, FW: 0.0, GW: 0.001, HW: 0.005, IW: 0.001, JW: 0.0, KW: 0.002, LW: 0.013, MW: 0.001, NW: 0.006, OW: 0.33, PW: 0.001, QW: 0.0, RW: 0.013, SW: 0.024, TW: 0.082, UW: 0.0, VW: 0.0, WW: 0.0, XW: 0.0, YW: 0.003, ZW: 0.000, AX: 0.019, BX: 0.0, CX: 0.0, DX: 0.0, EX: 0.214, FX: 0.0, GX: 0.0, HX: 0.0, IX: 0.022, JX: 0.0, KX: 0.0, LX: 0.0, MX: 0.000, NX: 0.003, OX: 0.019, PX: 0.0, QX: 0.0, RX: 0.001, SX: 0.0, TX: 0.0, UX: 0.004, VX: 0.0, WX: 0.0, XX: 0.003, YX: 0.0, ZX: 0.000, AY: 0.217, BY: 0.176, CY: 0.042, DY: 0.05, EY: 0.144, FY: 0.009, GY: 0.026, HY: 0.05, IY: 0.0, JY: 0.0, KY: 0.006, LY: 0.425, MY: 0.062, NY: 0.098, OY: 0.036, PY: 0.012, QY: 0.0, RY: 0.248, SY: 0.057, TY: 0.227, UY: 0.005, VY: 0.005, WY: 0.002, XY: 0.003, YY: 0.0, ZY: 0.002, AZ: 0.012, BZ: 0.0, CZ: 0.001, DZ: 0.0, EZ: 0.005, FZ: 0.0, GZ: 0.0, HZ: 0.0, IZ: 0.064, JZ: 0.0, KZ: 0.0, LZ: 0.0, MZ: 0.000, NZ: 0.004, OZ: 0.003, PZ: 0.0, QZ: 0.0, RZ: 0.001, SZ: 0.0, TZ: 0.004, UZ: 0.002, VZ: 0.0, WZ: 0.0, XZ: 0.0, YZ: 0.002, ZZ: 0.003 }

// divides a string into a list of words, using as separator either a whitespace, or
// a position where lowercase string is interrupted by one uppercase letter
const divideIntoWords = (inputString) => {
  const words = []
  let currentWord = ''

  for (let i = 0; i < inputString.length; i++) {
    const char = inputString[i]
    if (char === ' ' || (char >= 'A' && char <= 'Z' && currentWord.length > 0 && currentWord[currentWord.length - 1] >= 'a' && currentWord[currentWord.length - 1] <= 'z')) {
      words.push(currentWord.trim())
      currentWord = ''
    }
    currentWord += char
  }

  words.push(currentWord.trim())
  return words
}

// returns a "TTS readability" score of a string
const getReadabilityScore = (inp) => {
  let score = 0.0
  const words = divideIntoWords(inp).map(w => w.toUpperCase())

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    if (word.length >= 3 && wordExists(word)) {
      // if the whole word exists in an English dictionary, add a
      // high score for it, as if all its bigrams had a score of 1.0
      score += 1.0 * Math.floor(word.length / 2)
    } else {
      // otherwise, compute the score using the frequency of word's bigrams
      let wordScore1 = 0.0
      for (let j = 0; j < Math.floor(word.length / 2); j++) {
		  const bigram = word.substring(j * 2, j * 2 + 2)

		  if (bigramFrequencies.hasOwnProperty(bigram)) {
          wordScore1 += bigramFrequencies[bigram]
		  }
      }

      let wordScore2 = 0.0
      for (let j = 0; j < Math.floor(word.length / 2); j++) {
		  const bigram = word.substring(1 + j * 2, 1 + j * 2 + 2)

		  if (bigramFrequencies.hasOwnProperty(bigram)) {
          wordScore2 += bigramFrequencies[bigram]
		  }
      }

      score += Math.max(wordScore1, wordScore2)
    }
  }

  return score / inp.length
}

// returns either a readable version of an input name (divided into
// words by whitespace, with numbers and trailing T/Z/P removed) or a fallback string
export const getReadableName = (input, fallback) => {
  return getReadabilityScore(input) >= 0.38
    ? divideIntoWords(input).filter(w => !['T', 'Z', 'P'].includes(w) && isNaN(w)).join(' ')
    : fallback
}

// uses OpenAIAuth.py python script to get OpenAI access token using the email+password
export const getOpenAIAccessToken = async (email, password) => {
  return new Promise((resolve, reject) => {
    const script = spawn('python3', ['./OpenAIAuth.py', email, password])
    let output = ''

    script.stdout.on('data', (data) => {
      output += data.toString()
    })

    script.on('close', (code) => {
      if (code === 0) {
        resolve(output)
      } else {
        reject('Could not authenticate using OpenAI email+password and OpenAIAuth.py script.')
        process.exit()
      }
    })
  })
}

//testNames = ['Ibrahim Awwal', 'Tomas Cere', 'Tomas Vajda', 'Marian Devecka', 'UPStarcraftAI', 'Marek Kadek', 'Adrian Sternmuller', 'Jan Pajan', 'Igor Lacik', 'Krasimir Krystev', 'Roman Danielis', 'Matej Istenik', 'Marcin Bartnicki', 'Vladimir Jurenka', 'Dave Churchill', 'Soeren Klett', 'Gabriel Synnaeve', 'ICELab', 'David Hirschberg', 'Florian Richoux', 'Neo Edmund', 'Andrew Smith', 'Oleg Ostroumov', 'Daniel Blackburn', 'Martin Dekar', 'Maja Nemsilajova', 'Vaclav Horazny', 'Jakub Trancik', 'EradicatumXVR', 'Karin Valisova', 'Ivana Kellyerova', 'Marek Kruzliak', 'Ludmila Nemsilajova', 'Martin Strapko', 'Andrej Sekac', 'Matej Kravjar', 'Denis Ivancik', 'Martin Pinter', 'Iron bot', 'La Nuee', 'Lucia Pivackova', 'Martin Rooijackers', 'krasi0', 'Johannes Holzfuss', 'NUS Bot', 'Odin2014', 'Lukas Sedlacek', 'Vojtech Jirsa', 'Marek Suppa', 'Peter Dobsa', 'David Milec', 'tscmoo', 'Simon Prins', 'ASPbot2011', 'Serega', 'Matyas Novy', 'Tomasz Michalski', 'Chris Coxe', 'Gaoyuan Chen', 'tscmooz', 'Carsten Nielsen', 'Bjorn P Mattsson', 'Ian Nicholas DaCosta', 'Sungguk Cha', 'Jon  W', 'Sergei Lebedinskij', 'Aurelien Lermant', 'AILien', 'Rafael Bocquet', 'OpprimoBot', 'Chris Ayers', 'Radim Bobek', 'A Jarocki', 'Sijia Xu', 'tscmoop', 'Pablo Garcia Sanchez', 'Sebastian Mahr', 'Henri Kumpulainen', 'Marek Gajdos', 'JompaBot', 'PeregrineBot', 'insanitybot', 'Zealot Hell', 'Martin Vlcak', 'Nathan a David', 'Jacob Knudsen', 'Travis Shelton', 'VeRLab', 'High School Strats', 'Tae Jun Oh', 'FlashTest', 'LetaBot SSCAI 2015 Final', 'Flash', 'WuliBot', 'FlashZerg', 'Flashrelease', 'Rob Bogie old', 'LetaBot IM noMCTS', 'LetaBot IM noMCTS', 'LetaBot IM noMCTS', 'Zia bot', 'DAIDOES', 'AwesomeBot', 'ButcherBoy', 'Johan Kayser', 'HoangPhuc', 'neverdieTRX', 'LetaBot CIG 2016', 'Christoffer Artmann', 'LetaBot AIIDE 2016', 'MegaBot', 'ZerGreenBot', 'Bereaver', 'Steamhammer', 'BeeBot', 'auxanic', 'Tommy Fang', 'XelnagaII', 'Aman Zargarpur', 'UPStarCraftAI 2016', 'If Bot', 'Bacteria', 'McRave', 'ZurZurZur', 'Stone', 'Newbie Zerg', 'PurpleWave', 'KaonBot', '3 Rax Newbie', '5 Pool', 'Neo Edmund Zerg', 'Woantrik Pouni', 'Marine Hell', 'zLyfe', 'Velicorandom', 'Randomhammer', 'bftjoe', 'Zekhaw', 'NLPRbot', 'Kruecke', 'Blonws31', 'Raze and Plunder', 'Lukas Moravec', 'Rob Bogie', 'Microwave', 'PurpleCheese', 'PurpleSwarm', 'ForceBot', 'Vaclav Bayer', 'Pinfel', 'Dawid Loranc', 'Oyvind Johannessen', 'Hannes Bredberg', 'tscmoor', 'Pascal Vautour', 'Goliat', 'Arrakhammer', 'exampleclient', 'bftjoet', 'Anders Hein', 'zhandong', 'ZergYue', 'Black Crow', 'TyrProtoss', 'ChengweiJiang', 'Simplicity', 'Big eyes', 'Christian McCrave', 'Sparks', 'Antiga', 'JEMMET_old', 'Adrian Mensing', 'JEMMET', 'Yuanheng Zhu', 'AyyyLmao', 'Andrey Kurdiumov', 'Bryan Weber', 'bftjoet', 'Amal Duriseti', 'LetaBot AIIDE 2017', 'PurpleTickles', 'LetaBot CIG 2017', 'PurpleSpirit', 'WOPR Z', 'KillAlll', 'CasiaBot', 'adias', 'Hardcoded', 'Hardcoded', 'ForceBotTest', 'Niels Justesen', 'WillBot', 'MegaBot2017', 'NiteKatT', 'NiteKatP', 'krasi0P', 'ZZZKBot', 'Alice', 'Pineapple Cactus', 'HOLD Z', 'Locutus', 'igjbot', 'UC3ManoloBot', 'Cristhian Alcantara Lopez', '100382319', 'Laura Martin Gallardo', 'Lluvatar', 'Ecgberht', 'CherryPi', 'Guillermo Agitaperas', 'ClumsyBot', 'Hao Pan', 'WillyT', 'Zercgberht', 'Delingvery', 'SALT Bot', 'Toothpick Cactus', 'ggBot', 'MadMixP', 'Korean', 'FTTank', 'MadMixT', 'Fifouille Legend', 'FTTankTER', 'MorglozBot', 'hyeongjin park', 'Fifou Legend', 'CUBOT dupl', 'MadMixZ', 'DaleeTYC', 'tscmoop2', 'Dolphin Bot', 'Protecgberht', 'Middle School Strats', 'BananaBrain', 'Rhonin', 'MDBot', 'GuiBot', 'StyxZ', 'StyxZ2', 'legacy', 'skyFORKnet', 'Junkbot', 'Raphael', 'McRaveZ', 'Fifouille Legend Random', 'Proxy', 'Cydonia', 'UITtest', 'UITtest2', 'High School Strats', 'ABCDxyz', 'Wombat', 'StarCrusher', 'PearEasy', 'SummerHomework', 'Prism Cactus', 'DaQin', 'Assberht', 'SAIDA', 'PurpleWavelet', 'PotatoMasher', 'Oh Fish', 'CherryPi 2018 AIIDE MOD', 'Fresh Meat', 'ChimeraBot', 'JumpyDoggoBot', 'AntigaZ', 'VioletLily', 'FergalOGrady', 'CUBOT', 'Dolphin Bot dupl', 'XIAOYICOG2019', 'PurpleDestiny', 'Stardust', 'RedRum', 'Feint', 'Dragon', 'Boris', 'CherryPiSSCAIT2017', 'BetaStar', 'CherryPiSSCAIT2017 dupl', 'ZNZZBot', 'Crona', 'MadMixR', 'Slater', 'NuiBot', 'KasoBot', 'KangarooBot', 'DTD Bot', 'Amber', 'AmberZ', 'Hopark', 'Emperor Zerg', 'Monster', 'EggBot', 'Vyrebot', 'Bobot', 'Pathos', 'Sune Rasmussen', 'Zerg Hell', 'Terminus', 'Pylon Puller', 'Brainiac', 'MicRobot', 'Infested Artosis', 'Pinfel 2']
//testNames.forEach(n => {
//  console.log(getReadableName(n, '---'))
//})
