import fs from 'node:fs';

const rawCookies = [
    {
        "domain": ".youtube.com",
        "expirationDate": 1827171182.211569,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-YEC",
        "path": "/",
        "sameSite": "lax",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "Cgt4V3hyNzVueDU0MCjx1f7WBjIoCgJFUxIiEh4SHAsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicgZ0gBYtsCCtgCQ3Y4QkNBWVNzUUVCV3liWjZHaFhZelpNVEJFZHlscXJGcHRSaXJkdmxKVG9LZktGc1NHUGVPZVEtVmptT1kyYVJDTGh6WDgtek4zdzVzdTlnbGZWcG04TnZhSHg2OE9GdkZpWmw4ZXIxVFdSX0c0b3ZYUjkyWG40R25uZWRRSUtpZFYxOG1VY1p5MUhId01WUXZjNFk4MzJuTkRoT1VQa1ZRSE80T2wxTVB3d2pPUUZKd2FxT1VKTUR3cm5GUEUtQ2l2Q0taeFV2LXVsR1daUWFkWVZOY1ZmQnhtbFhBb19jSnV1TVBCZllIZlFZMnE3b0NUT0tyc29CakpGQWJKb24yVlRadjdXcjZjY1ZCWjRFMjM0OHVieEZMRW1Pdldyd3RFQ0ZMRFdobTg2NXViOVFaNGFwZnBOZ05UM0tydy0zMGJaeDJjaWNQUllQYUxtMmtydDNVTUw%3D"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827603183.361274,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-3PSID",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "g.a000EAld0-Pwi6ckcl8eofcw7jj0jh_j0GdkydJCcWEiij5nSTVds0xDPrN2ZiLxbNCALbgC3AACgYKAQsSARISFQHGX2MibC1Wdd6JTUjv708C_v0saBoVAUF8yKoqPicyvtpe-z_eyQ_dWm8_0076"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1824579188.579032,
        "hostOnly": false,
        "httpOnly": false,
        "name": "SIDCC",
        "path": "/",
        "sameSite": null,
        "secure": false,
        "session": false,
        "storeId": null,
        "value": "APD_SKEhuZXa24M-n2AsmjuZmSU7rlHVrA8UD1t1sFckMb35lnH8CHeD8NbojGNIJDdaBzjUIA"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827603183.361158,
        "hostOnly": false,
        "httpOnly": false,
        "name": "SID",
        "path": "/",
        "sameSite": null,
        "secure": false,
        "session": false,
        "storeId": null,
        "value": "g.a000EAld0-Pwi6ckcl8eofcw7jj0jh_j0GdkydJCcWEiij5nSTVdZSERCTQlBuHKOo96q5kSogACgYKAXoSARISFQHGX2MiIC_6eTB95q3OfFnbZBXY9BoVAUF8yKoMh23E-814FYE8734DLWei0076"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1824579188.578852,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-1PSIDTS",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "sidts-CjUBkldj_5vn6H78RvMEkfgMapT6DnHFv8sYx4wzZpmouQ310IAbzqje32Um9t6OkR6U53O21RAA"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1793043791,
        "hostOnly": false,
        "httpOnly": false,
        "name": "CONSISTENCY",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "AIudn8oaxofhugaCpj226tnt1QPWfysG0qI4WqF_mhXAESKx9Hddc6HKmThdsSYYyErH3ANlJ-QX6HgVr7rzqCIahfOJN1Ox7SMzhADxo9Zkt42Fdv99kIecVqStEM-GOetIYoqReYPFFHiHZij2FKjIRzjC3K8thZoWW0EFopEH_Q"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827603183.360651,
        "hostOnly": false,
        "httpOnly": false,
        "name": "SAPISID",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "mTbwhJqxIWPpWmKc/AZWo8cU3UsJG9t_vP"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1824579188.579093,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-1PSIDCC",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "APD_SKHkmS4KeJ3SgnK-OU7AmrPwWoKk27oHbMV8K80EeKsH4rWRc6C84457GOPiXzsA6YsW4A"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827603183.360514,
        "hostOnly": false,
        "httpOnly": true,
        "name": "SSID",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "A4QPTvGqeU_iWlhIS"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827603183.360701,
        "hostOnly": false,
        "httpOnly": false,
        "name": "__Secure-1PAPISID",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "mTbwhJqxIWPpWmKc/AZWo8cU3UsJG9t_vP"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827603183.361221,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-1PSID",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "g.a000EAld0-Pwi6ckcl8eofcw7jj0jh_j0GdkydJCcWEiij5nSTVdJnHgSgwNPpKHJAD37JiGmwACgYKAX0SARISFQHGX2MiKr7G0MqnntFhk451OGN2kRoVAUF8yKoXZ1CPv3myEJrT322CdLeu0076"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827603183.360753,
        "hostOnly": false,
        "httpOnly": false,
        "name": "__Secure-3PAPISID",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "mTbwhJqxIWPpWmKc/AZWo8cU3UsJG9t_vP"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1824579188.579148,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-3PSIDCC",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "APD_SKH78Mk9en_3MnKI7OYgQzhImYuKq9vWGX77JLbiEociTTLzdCThDobXNiNePIF4SJNJ"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1824579188.578969,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-3PSIDTS",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "sidts-CjUBkldj_5vn6H78RvMEkfgMapT6DnHFv8sYx4wzZpmouQ310IAbzqje32Um9t6OkR6U53O21RAA"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827171183.086666,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-YENID",
        "path": "/",
        "sameSite": "lax",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "Cv8BCAYSsQEBWybZ6GhXYzZMTBEdylqrFptRirdvlJToKfKFsSGPeOeQ-VjmOY2aRCLhzX8-zN3w5su9glfVpm8NvaHx68OFvFiZl8er1TWR_G4ovXR92Xn4GnnedQIKidV18mUcZy1HHwMVQvc4Y832nNDhOUPkVQHO4Ol1MPwwjOQFJwaqOUJMDwrnFPE-CivCKZxUv-ulGWZQadYVNcVfBxmlXAo_cJuuMPBfYHfQY2q7oCTOKrsoBjJFAbJon2VTZv7Wr6ccVBZ4E2348ubxFLEmOvWrwtECFLDWhm865ub9QZ4apfpNgNT3Krw-30bZx2cicPRYPaLm2krt3UML"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827603183.360584,
        "hostOnly": false,
        "httpOnly": false,
        "name": "APISID",
        "path": "/",
        "sameSite": null,
        "secure": false,
        "session": false,
        "storeId": null,
        "value": "-JBbiEzr3yCLE0Z1/Ap4O2tGyVloEDQetB"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827603183.36036,
        "hostOnly": false,
        "httpOnly": true,
        "name": "HSID",
        "path": "/",
        "sameSite": null,
        "secure": false,
        "session": false,
        "storeId": null,
        "value": "A5zN8Aupj984OyRiC"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827601732.623142,
        "hostOnly": false,
        "httpOnly": true,
        "name": "LOGIN_INFO",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "AFmmF2swRQIgQkyEojqRAKRPIBC9YizK4weGf8Th87r97zu63jARfSACIQCGssPU2BLBPA_W7E0tZ-osPqciDN4wmyYDOUf__pzVBQ:QUQ3MjNmdzVLVFFLMTYzQTBkZzJVZEJVNEdrOFFBS1NjTk92eXVlR0RfUE5GcUpqb1o2cTIwSUxQSlJ3T1JnOEc1UDhFWFNoQXRuOEZ4dUgyaHBWVUZfNTFxNnZFbU9pdGQwWnBlMFBmcUhxcGdjSzhyVzFkWW1jNHFJbnlCeXBwWkM0VGo0Z3BfZ3pUYmlDbVJPcmtOYm51WjNnM0lWaTBB"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1808854387.441019,
        "hostOnly": false,
        "httpOnly": true,
        "name": "NID",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "CvoBCAESrAEBOxGDSEjxJXyRp0KYqIf3A3jkjnCbVzerKrhl9ajk8gANDDWsBpj4UMjU0RjIC7UG0_LBFUmvXKcfctrs3ilSyXesW9AWkrWIkjfv-lDvA9O4JdOGsqkTKMds8WCwlzTrzQrtM9838xvC7bg_zACVMKoTcarep0O8nvIE3XgMcQagDcEGVDCABJPnlCZxcAbiveb0dGdREf-OeZBNv6XUYXuMt2PF8_AaYSBTKAEyRQHSrAfPFevHmzoBI8qQHZtXwvX3mHjw698GbsbnHP58gi8fVieqfDQwh8CbxytbzA-97NMYmDXLHeGPHkbOc_DBUJihBw"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1827603186.245738,
        "hostOnly": false,
        "httpOnly": false,
        "name": "PREF",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "f4=4000000&f6=40000000&tz=Europe.Madrid"
    }
];

let netscape = '# Netscape HTTP Cookie File\n# https://curl.se/docs/http-cookies.html\n# This file was generated by Spotifree\n\n';

for (const c of rawCookies) {
  const domain = c.domain;
  const flag = domain.startsWith('.') ? 'TRUE' : 'FALSE';
  const path = c.path || '/';
  const secure = c.secure ? 'TRUE' : 'FALSE';
  const exp = Math.round(c.expirationDate || (Date.now() / 1000 + 86400 * 365));
  const name = c.name;
  const val = c.value;
  netscape += `${domain}\t${flag}\t${path}\t${secure}\t${exp}\t${name}\t${val}\n`;
}

fs.writeFileSync('cookies.txt', netscape, 'utf8');
console.log('cookies.txt successfully created! Total bytes:', netscape.length);
