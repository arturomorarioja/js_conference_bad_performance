/* Northstar conference programme UI. */
var API_URL = 'http://localhost:19437/api';
var sessions = [];
var conference = null;
var activeDay = '';
var searchTerm = '';
var chosenFormat = '';
var chosenTracks = [];
var savedOnly = false;
var saved = [];

function requestJson(path) {
    var request = new XMLHttpRequest();
    request.open('GET', API_URL + path, false);
    request.send();
    if (request.status !== 200) {
        throw new Error('The conference API returned ' + request.status);
    }
    return JSON.parse(request.responseText);
}

function dayLabel(day) {
    return new Date(day + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short'
    });
}

function makeFilters() {
    var list = document.getElementById('track-list');
    for (var i = 0; i < conference.tracks.length; i++) {
        var track = conference.tracks[i];
        var item = document.createElement('li');
        item.innerHTML = '<label class="track-option"><input type="checkbox" value="' +
            track.slug + '"> ' + track.name + '</label>';
        list.appendChild(item);
        item.querySelector('input').addEventListener('change', function () {
            chosenTracks = [];
            var fields = list.querySelectorAll('input:checked');
            for (var j = 0; j < fields.length; j++) {
                chosenTracks.push(fields[j].value);
            }
            renderSchedule();
        });
    }

    var formatSelect = document.getElementById('format-filter');
    for (var k = 0; k < conference.formats.length; k++) {
        var option = document.createElement('option');
        option.value = conference.formats[k];
        option.textContent = conference.formats[k];
        formatSelect.appendChild(option);
    }
    formatSelect.addEventListener('change', function () {
        chosenFormat = formatSelect.value;
        renderSchedule();
    });

    var days = document.getElementById('day-list');
    for (var dayIndex = 0; dayIndex < conference.days.length; dayIndex++) {
        var day = conference.days[dayIndex];
        var item = document.createElement('li');
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = dayLabel(day);
        button.dataset.day = day;
        button.addEventListener('click', function () {
            activeDay = this.dataset.day;
            setSelectedDay();
            renderSchedule();
        });
        item.appendChild(button);
        days.appendChild(item);
    }
    setSelectedDay();
}

function setSelectedDay() {
    var buttons = document.querySelectorAll('#day-list button');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute('aria-pressed', String(buttons[i].dataset.day === activeDay));
    }
}

function isVisible(session) {
    if (session.day !== activeDay) return false;
    if (chosenTracks.length && chosenTracks.indexOf(session.track) === -1) return false;
    if (chosenFormat && session.format !== chosenFormat) return false;
    if (savedOnly && saved.indexOf(session.id) === -1) return false;
    if (searchTerm) {
        var text = (session.title + ' ' + session.summary + ' ' +
            session.speakers.map(function (speaker) { return speaker.name; }).join(' ')).toLowerCase();
        if (text.indexOf(searchTerm) === -1) return false;
    }
    return true;
}

function makeSessionCard(session) {
    var card = document.createElement('div');
    card.className = 'session-card';
    // The programme lists a brief summary; retrieve the complete record for the card.
    var details = requestJson('/sessions/' + session.id);
    var speaker = details.speakers[0];
    card.innerHTML =
        '<div class="session-top"><span class="track-tag">' + session.track_name + '</span>' +
        '<span class="format-tag">' + session.format + '</span></div>' +
        '<h3>' + session.title + '</h3>' +
        '<p class="session-summary">' + session.summary + '</p>' +
        '<div class="speaker-line"><img class="speaker-photo" src="assets/speakers/' + speaker.image + '.jpg" alt="">' +
        '<span class="speaker-name">' + speaker.name + '</span></div>' +
        '<div class="card-actions"><span class="room">' + session.room + ' · ' + session.start_time + '</span>' +
        '<div class="action-group"><button type="button" class="details-button">Details</button>' +
        '<button type="button" class="save-button" aria-pressed="' + (saved.indexOf(session.id) !== -1) + '">' +
        (saved.indexOf(session.id) !== -1 ? '★ Saved' : '☆ Save') + '</button></div></div>';

    card.querySelector('.details-button').addEventListener('click', function () {
        showDetails(session.id);
    });
    card.querySelector('.save-button').addEventListener('click', function () {
        toggleSaved(session.id);
    });
    return card;
}

function alignSessionCards(row) {
    var cards = row.querySelectorAll('.session-card');
    var tallest = 0;

    for (var i = 0; i < cards.length; i++) {
        cards[i].style.minHeight = '';
        tallest = Math.max(tallest, cards[i].offsetHeight);
    }
    for (var j = 0; j < cards.length; j++) {
        cards[j].style.minHeight = tallest + 'px';
    }
}

function renderSchedule() {
    var container = document.getElementById('schedule');
    container.innerHTML = '';
    var count = 0;
    var lastTime = '';
    var row = null;

    sessions.sort(function (a, b) {
        return a.day.localeCompare(b.day) || a.start_time.localeCompare(b.start_time);
    });

    for (var i = 0; i < sessions.length; i++) {
        var session = sessions[i];
        if (!isVisible(session)) continue;
        if (session.start_time !== lastTime) {
            var group = document.createElement('div');
            group.className = 'time-group';
            var marker = document.createElement('div');
            marker.className = 'time-marker';
            marker.textContent = session.start_time;
            row = document.createElement('div');
            row.className = 'session-list';
            group.appendChild(marker);
            group.appendChild(row);
            container.appendChild(group);
            lastTime = session.start_time;
        }
        row.appendChild(makeSessionCard(session));
        alignSessionCards(row);
        count++;
    }

    if (count === 0) {
        container.innerHTML = '<p class="empty-state">No sessions match your filters.</p>';
    }
    document.getElementById('day-heading').textContent = dayLabel(activeDay);
    document.getElementById('result-count').textContent = count + ' sessions';
    document.getElementById('saved-count').textContent = saved.length;
}

function toggleSaved(id) {
    var index = saved.indexOf(id);
    if (index === -1) saved.push(id);
    else saved.splice(index, 1);
    localStorage.setItem('northstar-saved', JSON.stringify(saved));
    renderSchedule();
}

function showDetails(id) {
    try {
        var detail = requestJson('/sessions/' + id);
        document.getElementById('dialog-title').textContent = detail.title;
        document.getElementById('dialog-meta').textContent =
            dayLabel(detail.day) + ' · ' + detail.start_time + '–' + detail.end_time +
            ' · ' + detail.room + ' · ' + detail.format;
        document.getElementById('dialog-description').textContent = detail.description;
        var speakers = document.getElementById('dialog-speakers');
        speakers.innerHTML = '';
        for (var i = 0; i < detail.speakers.length; i++) {
            var speaker = detail.speakers[i];
            var item = document.createElement('div');
            item.className = 'dialog-person';
            item.innerHTML = '<img src="assets/speakers/' + speaker.image + '.jpg" alt="">' +
                '<span><strong>' + speaker.name + '</strong><small>' +
                speaker.title + ' · ' + speaker.organisation + '</small></span>';
            speakers.appendChild(item);
        }
        document.getElementById('details-dialog').showModal();
    } catch (error) {
        alert('Could not load details: ' + error.message);
    }
}

function start() {
    try {
        saved = JSON.parse(localStorage.getItem('northstar-saved') || '[]');
        if (!Array.isArray(saved)) saved = [];
    } catch (error) {
        saved = [];
    }
    try {
        conference = requestJson('/meta');
        activeDay = conference.days[0];
        for (var i = 0; i < conference.days.length; i++) {
            var response = requestJson('/sessions?day=' + encodeURIComponent(conference.days[i]));
            sessions = sessions.concat(response.sessions);
        }
        makeFilters();
        renderSchedule();
    } catch (error) {
        document.getElementById('day-heading').textContent = 'Unable to load the programme';
        document.getElementById('schedule').textContent =
            'Start the API on http://localhost:19437 and reload. ' + error.message;
        return;
    }

    document.getElementById('search-input').addEventListener('input', function () {
        searchTerm = this.value.toLowerCase().trim();
        renderSchedule();
    });
    document.getElementById('saved-filter').addEventListener('click', function () {
        savedOnly = !savedOnly;
        this.setAttribute('aria-pressed', String(savedOnly));
        renderSchedule();
    });
    document.getElementById('dialog-close').addEventListener('click', function () {
        document.getElementById('details-dialog').close();
    });
}

window.addEventListener('load', start);
