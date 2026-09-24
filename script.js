// ===== 1. Hämta elementen vi behöver från HTML-sidan =====
const formular = document.getElementById("sokformular");
const stadInput = document.getElementById("stad");
const statusRuta = document.getElementById("status");
const aktuelltRuta = document.getElementById("aktuellt");
const prognosRuta = document.getElementById("prognos");


// ===== 2. Väderkoder =====
// Open-Meteo skickar en sifferkod för vädret (WMO-kod).
// Det här objektet översätter koden till svensk text och en ikon.
const vaderkoder = {
    0:  { text: "Klart", ikon: "☀️" },
    1:  { text: "Mestadels klart", ikon: "🌤️" },
    2:  { text: "Halvklart", ikon: "⛅" },
    3:  { text: "Mulet", ikon: "☁️" },
    45: { text: "Dimma", ikon: "🌫️" },
    48: { text: "Frostdimma", ikon: "🌫️" },
    51: { text: "Lätt duggregn", ikon: "🌦️" },
    53: { text: "Duggregn", ikon: "🌦️" },
    55: { text: "Kraftigt duggregn", ikon: "🌧️" },
    56: { text: "Underkylt duggregn", ikon: "🌧️" },
    57: { text: "Underkylt duggregn", ikon: "🌧️" },
    61: { text: "Lätt regn", ikon: "🌦️" },
    63: { text: "Regn", ikon: "🌧️" },
    65: { text: "Kraftigt regn", ikon: "🌧️" },
    66: { text: "Underkylt regn", ikon: "🌧️" },
    67: { text: "Underkylt regn", ikon: "🌧️" },
    71: { text: "Lätt snöfall", ikon: "🌨️" },
    73: { text: "Snöfall", ikon: "🌨️" },
    75: { text: "Kraftigt snöfall", ikon: "❄️" },
    77: { text: "Snökorn", ikon: "🌨️" },
    80: { text: "Lätta regnskurar", ikon: "🌦️" },
    81: { text: "Regnskurar", ikon: "🌧️" },
    82: { text: "Kraftiga regnskurar", ikon: "🌧️" },
    85: { text: "Snöbyar", ikon: "🌨️" },
    86: { text: "Kraftiga snöbyar", ikon: "❄️" },
    95: { text: "Åska", ikon: "⛈️" },
    96: { text: "Åska med hagel", ikon: "⛈️" },
    99: { text: "Åska med hagel", ikon: "⛈️" }
};

function beskrivVader(kod) {
    // Om koden inte finns i listan returnerar vi ett reservvärde
    if (vaderkoder[kod]) {
        return vaderkoder[kod];
    }
    return { text: "Okänt väder", ikon: "❔" };
}


// ===== 3. AJAX-funktion med XMLHttpRequest =====
// Hämtar JSON från en adress. När det är klart anropas antingen
// vidLyckat(data) eller vidFel(meddelande).
function hamtaJSON(url, vidLyckat, vidFel) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);

    xhr.onreadystatechange = function () {
        // readyState 4 = anropet är helt klart
        if (xhr.readyState !== 4) {
            return;
        }

        if (xhr.status === 200) {
            // Allt gick bra – försök göra om texten till ett JavaScript-objekt
            try {
                const data = JSON.parse(xhr.responseText);
                vidLyckat(data);
            } catch (fel) {
                vidFel("Svaret från vädertjänsten gick inte att läsa.");
            }
        } else if (xhr.status === 0) {
            // Status 0 betyder att vi inte fick något svar alls
            vidFel("Ingen kontakt med vädertjänsten. Kontrollera din internetanslutning.");
        } else {
            vidFel("Vädertjänsten svarade med felkod " + xhr.status + ". Försök igen om en stund.");
        }
    };

    xhr.send();
}


// ===== 4. Hjälpfunktioner för statusraden =====
function visaStatus(text) {
    statusRuta.textContent = text;
    statusRuta.className = "status";
    statusRuta.hidden = (text === "");
}

function visaFel(text) {
    // textContent (inte innerHTML) så att det användaren skrivit
    // aldrig tolkas som HTML-kod
    statusRuta.textContent = text;
    statusRuta.className = "status fel";
    statusRuta.hidden = false;
    aktuelltRuta.hidden = true;
    prognosRuta.hidden = true;
}

function formateraDatum(datumText) {
    // "2026-09-24" → "tors 24 sep."
    // T12:00 läggs till så att datumet inte hoppar en dag pga tidszoner
    const datum = new Date(datumText + "T12:00");
    return datum.toLocaleDateString("sv-SE", {
        weekday: "short",
        day: "numeric",
        month: "short"
    });
}


// ===== 5. När användaren söker =====
formular.addEventListener("submit", function (event) {
    event.preventDefault();   // stoppa att sidan laddas om

    const stad = stadInput.value.trim();

    // Felhantering: tomt sökfält
    if (stad === "") {
        visaFel("Skriv in namnet på en stad.");
        return;
    }

    visaStatus("Söker efter " + stad + " …");

    // Steg 1: gör om stadens namn till koordinater (geocoding)
    const url = "https://geocoding-api.open-meteo.com/v1/search"
        + "?name=" + encodeURIComponent(stad)
        + "&count=1&language=sv&format=json";

    hamtaJSON(url, function (data) {
        // Felhantering: staden finns inte
        if (!data.results || data.results.length === 0) {
            visaFel("Hittade ingen stad som heter \"" + stad + "\". Kontrollera stavningen.");
            return;
        }

        const plats = data.results[0];
        hamtaVader(plats);
    }, visaFel);
});


// ===== 6. Hämta vädret för platsen =====
function hamtaVader(plats) {
    visaStatus("Hämtar väder för " + plats.name + " …");

    // Steg 2: hämta väder med koordinaterna
    const url = "https://api.open-meteo.com/v1/forecast"
        + "?latitude=" + plats.latitude
        + "&longitude=" + plats.longitude
        + "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m"
        + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum"
        + "&wind_speed_unit=ms&timezone=auto&forecast_days=6";

    hamtaJSON(url, function (data) {
        visaStatus("");
        visaAktuellt(plats, data.current);
        visaPrognos(data.daily);
    }, visaFel);
}


// ===== 7. Dynamisk HTML: aktuellt väder =====
function visaAktuellt(plats, nu) {
    const vader = beskrivVader(nu.weather_code);

    // Län/region och land, t.ex. "Västra Götaland, Sverige"
    let omrade = plats.country;
    if (plats.admin1) {
        omrade = plats.admin1 + ", " + plats.country;
    }

    aktuelltRuta.innerHTML = `
        <h2 class="plats">${plats.name}</h2>
        <p class="omrade">${omrade}</p>
        <div class="nu">
            <span class="ikon-stor" aria-hidden="true">${vader.ikon}</span>
            <p class="temperatur">${Math.round(nu.temperature_2m)}°</p>
        </div>
        <p class="beskrivning">${vader.text}</p>
        <dl class="detaljer">
            <div><dt>Känns som</dt><dd>${Math.round(nu.apparent_temperature)}°</dd></div>
            <div><dt>Vind</dt><dd>${Math.round(nu.wind_speed_10m)} m/s</dd></div>
            <div><dt>Luftfuktighet</dt><dd>${nu.relative_humidity_2m} %</dd></div>
        </dl>
    `;
    aktuelltRuta.hidden = false;
}


// ===== 8. Dynamisk HTML: prognos med en loop =====
function visaPrognos(dagar) {
    let html = "<h2>Kommande dagar</h2><ol class=\"dagar\">";

    // Index 0 är idag, så vi börjar på 1 för att visa de fem kommande dagarna
    for (let i = 1; i < dagar.time.length; i++) {
        const vader = beskrivVader(dagar.weather_code[i]);

        html += `
            <li class="dag">
                <p class="veckodag">${formateraDatum(dagar.time[i])}</p>
                <span class="ikon" aria-hidden="true">${vader.ikon}</span>
                <p class="dag-text">${vader.text}</p>
                <p class="temp">
                    <span class="max">${Math.round(dagar.temperature_2m_max[i])}°</span>
                    <span class="min">${Math.round(dagar.temperature_2m_min[i])}°</span>
                </p>
                <p class="nederbord">${dagar.precipitation_sum[i]} mm</p>
            </li>
        `;
    }

    html += "</ol>";
    prognosRuta.innerHTML = html;
    prognosRuta.hidden = false;
}
