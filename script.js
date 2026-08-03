const LEGACY_STORAGE_KEY = "meeting-calendar-schedule-v4";
const STORAGE_KEY_PREFIX = "meeting-calendar-schedule-v5:";
const MAX_STUDENTS_PER_DAY = 10;

const DAY_START = 8 * 60;
const DAY_END = 18 * 60;

const TIMELINE_HEADER_HEIGHT = 32;
const TIMELINE_BODY_HEIGHT = 420;

const DEFAULT_START_TIME = "09:00";

const BOOKING_COLORS = [
    "#2563eb",
    "#7c3aed",
    "#0891b2",
    "#059669",
    "#d97706",
    "#dc2626",
    "#4f46e5",
    "#0f766e",
    "#9333ea",
    "#c2410c"
];

const GPT_PROMPT = `Генерирай списък със студенти за директно поставяне в полето за масово добавяне.

Използвай точно един от следните формати:

1) За вече избрана дата:
Име,Фамилия,Университет,Часове за деня,Наставник

2) С конкретна дата:
Дата,Име,Фамилия,Университет,Часове за деня,Наставник

3) С дата и план:
Дата,План,Име,Фамилия,Университет,Часове за деня,Наставник

Правила:
- Датата да бъде във формат YYYY-MM-DD.
- При посочена дата всеки запис трябва да се добави към точно тази дата, независимо кой ден е избран в календара.
- Не е необходимо да има избран ден в календара, когато всеки запис съдържа дата.
- Часовете да бъдат число от 0.5 до 9, през стъпка 0.5.
- Всеки студент да бъде отделен с точка и запетая или да бъде на нов ред.
- Не добавяй заглавия, номерация, обяснения или markdown таблица.
- Не пропускай име, фамилия, часове и наставник.

Пример:
2026-09-07,Консултации,Иван,Иванов,УНИБИТ,6,Магдалена Христова Иванова;
2026-09-08,Консултации,Мария,Петрова,СУ,4.5,Петър Димитров`;

const $ = (id) => document.getElementById(id);

const calendarBox = $("calendarBox");
const prevMonthBtn = $("prevMonthBtn");
const monthTitle = $("monthTitle");
const nextMonthBtn = $("nextMonthBtn");
const calendarDays = $("calendarDays");

const detailsBox = $("detailsBox");
const selectedDateText = $("selectedDateText");
const sidePreview = $("sidePreview");

const studentForm = $("studentForm");
const formTitle = $("formTitle");
const dayNameInput = $("dayName");
const startTimeInput = $("startTime");
const endTimeInput = $("endTime");
const hoursForTheDayInput = $("hoursForTheDay");
const firstNameInput = $("firstName");
const lastNameInput = $("lastName");
const facultyNumberInput = $("facultyNumber");
const universityInput = $("university");
const mentorInput = $("mentor");
const saveBtn = $("saveBtn");
const cancelEditBtn = $("cancelEditBtn");
const formMessage = $("formMessage");

const copyPromptBtn = $("copyPromptBtn");
const bulkEditor = $("bulkEditor");
const bulkHighlightLayer = $("bulkHighlightLayer");
const bulkStudentsInput = $("bulkStudentsInput");
const addStudentsListBtn = $("addStudentsListBtn");
const clearStudentsListBtn = $("clearStudentsListBtn");
const bulkResult = $("bulkResult");
const bulkAddedCount = $("bulkAddedCount");
const bulkSkippedCount = $("bulkSkippedCount");
const bulkErrorCount = $("bulkErrorCount");
const bulkErrorList = $("bulkErrorList");
const bulkMessage = $("bulkMessage");
const copyPromptStatus = $("copyPromptStatus");

const today = new Date();

today.setHours(
    0,
    0,
    0,
    0
);

let currentYear =
    today.getFullYear();

let currentMonth =
    today.getMonth();

let selectedDate = null;
let editingId = null;

migrateLegacySchedule();
cleanupExpiredMonthStorage();

let schedule =
    loadSchedule();

function createId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );
}

function clean(value) {
    return String(value ?? "")
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim();
}

function comparable(value) {
    return clean(value)
        .toLocaleLowerCase("bg-BG");
}

function dateToKey(date) {
    return [
        date.getFullYear(),
        String(
            date.getMonth() + 1
        ).padStart(2, "0"),
        String(
            date.getDate()
        ).padStart(2, "0")
    ].join("-");
}

function keyToDate(key) {
    const match =
        /^(\d{4})-(\d{2})-(\d{2})$/
            .exec(key);

    if (!match) {
        return null;
    }

    const date =
        new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        );

    date.setHours(
        0,
        0,
        0,
        0
    );

    if (
        date.getFullYear() !==
            Number(match[1]) ||
        date.getMonth() !==
            Number(match[2]) - 1 ||
        date.getDate() !==
            Number(match[3])
    ) {
        return null;
    }

    return date;
}

function parseDate(value) {
    const text =
        clean(value)
            .replace(
                /^["']|["']$/g,
                ""
            );

    let match =
        /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/
            .exec(text);

    if (match) {
        const date =
            new Date(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3])
            );

        date.setHours(
            0,
            0,
            0,
            0
        );

        if (
            date.getFullYear() === Number(match[1]) &&
            date.getMonth() === Number(match[2]) - 1 &&
            date.getDate() === Number(match[3])
        ) {
            return date;
        }
    }

    match =
        /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
            .exec(text);

    if (match) {
        const date =
            new Date(
                Number(match[3]),
                Number(match[2]) - 1,
                Number(match[1])
            );

        date.setHours(
            0,
            0,
            0,
            0
        );

        if (
            date.getFullYear() === Number(match[3]) &&
            date.getMonth() === Number(match[2]) - 1 &&
            date.getDate() === Number(match[1])
        ) {
            return date;
        }
    }

    return null;
}

function isWeekend(date) {
    return (
        date.getDay() === 0 ||
        date.getDay() === 6
    );
}

function isUnavailable(date) {
    return (
        date < today ||
        isWeekend(date)
    );
}

function timeToMinutes(value) {
    const match =
        /^(\d{1,2}):(\d{2})$/
            .exec(
                String(value ?? "")
            );

    if (!match) {
        return null;
    }

    const hours =
        Number(match[1]);

    const minutes =
        Number(match[2]);

    if (
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null;
    }

    return hours * 60 + minutes;
}

function minutesToTime(total) {
    if (
        !Number.isFinite(total) ||
        total < 0 ||
        total > 24 * 60
    ) {
        return null;
    }

    const hours =
        Math.floor(total / 60);

    const minutes =
        total % 60;

    return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0")
    );
}

function parseHours(value) {
    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        return null;
    }

    const hours =
        Number(
            String(value)
                .trim()
                .replace(",", ".")
        );

    return Number.isFinite(hours)
        ? hours
        : null;
}

function hoursBetween(
    startTime,
    endTime
) {
    const start =
        timeToMinutes(startTime);

    const end =
        timeToMinutes(endTime);

    if (
        start === null ||
        end === null ||
        end <= start
    ) {
        return null;
    }

    return (end - start) / 60;
}

function endTimeFromHours(
    startTime,
    hoursValue
) {
    const start =
        timeToMinutes(startTime);

    const hours =
        parseHours(hoursValue);

    if (
        start === null ||
        hours === null ||
        hours <= 0
    ) {
        return null;
    }

    const end =
        start +
        Math.round(hours * 60);

    if (end > DAY_END) {
        return null;
    }

    return minutesToTime(end);
}

function normalizeBooking(raw = {}) {
    const startTime =
        timeToMinutes(raw.startTime) !== null
            ? raw.startTime
            : DEFAULT_START_TIME;

    let hours =
        parseHours(
            raw.HoursForTheDay ??
            raw.hoursForTheDay
        );

    let endTime =
        timeToMinutes(raw.endTime) !== null
            ? raw.endTime
            : null;

    if (
        hours === null &&
        endTime
    ) {
        hours =
            hoursBetween(
                startTime,
                endTime
            );
    }

    if (
        hours === null ||
        hours <= 0
    ) {
        hours = 0.5;
    }

    if (!endTime) {
        endTime =
            endTimeFromHours(
                startTime,
                hours
            ) ||
            "09:30";
    }

    return {
        id:
            String(
                raw.id ||
                createId()
            ),

        firstName:
            clean(raw.firstName),

        lastName:
            clean(raw.lastName),

        facultyNumber:
            clean(raw.facultyNumber),

        university:
            clean(raw.university),

        startTime,

        endTime,

        HoursForTheDay:
            hours,

        mentor:
            clean(raw.mentor)
    };
}

function normalizeDay(raw = {}) {
    const bookings =
        Array.isArray(raw.bookings)
            ? raw.bookings
            : [];

    return {
        dayName:
            clean(raw.dayName),

        bookings:
            bookings
                .map(normalizeBooking)
                .filter(
                    function (booking) {
                        return (
                            booking.firstName &&
                            booking.lastName
                        );
                    }
                )
                .slice(
                    0,
                    MAX_STUDENTS_PER_DAY
                )
    };
}

function monthKeyFromParts(
    year,
    monthIndex
) {
    return (
        String(year) +
        "-" +
        String(monthIndex + 1)
            .padStart(2, "0")
    );
}

function monthKeyFromDateKey(
    dateKey
) {
    return keyToDate(dateKey)
        ? dateKey.slice(0, 7)
        : null;
}

function currentMonthKey() {
    return monthKeyFromParts(
        currentYear,
        currentMonth
    );
}

function storageKeyForMonth(
    monthKey
) {
    return (
        STORAGE_KEY_PREFIX +
        monthKey
    );
}

function normalizeMonthSchedule(
    raw,
    expectedMonthKey
) {
    if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw)
    ) {
        return {};
    }

    const result = {};

    Object.entries(raw).forEach(
        function (
            [dateKey, dayData]
        ) {
            if (
                monthKeyFromDateKey(dateKey) ===
                expectedMonthKey
            ) {
                result[dateKey] =
                    normalizeDay(dayData);
            }
        }
    );

    return result;
}

function parseMonthScheduleValue(
    rawValue,
    monthKey
) {
    if (!rawValue) {
        return {};
    }

    try {
        return normalizeMonthSchedule(
            JSON.parse(rawValue),
            monthKey
        );
    } catch (error) {
        console.error(
            "Грешка при зареждане на месец " +
                monthKey +
                " от localStorage:",
            error
        );

        return {};
    }
}

function loadMonthSchedule(
    monthKey
) {
    return parseMonthScheduleValue(
        localStorage.getItem(
            storageKeyForMonth(monthKey)
        ),
        monthKey
    );
}

function loadLegacyMonthSchedule(
    monthKey
) {
    try {
        const legacyRaw =
            localStorage.getItem(
                LEGACY_STORAGE_KEY
            );

        if (!legacyRaw) {
            return {};
        }

        return normalizeMonthSchedule(
            JSON.parse(legacyRaw),
            monthKey
        );
    } catch (error) {
        console.error(
            "Грешка при зареждане на старите данни от localStorage:",
            error
        );

        return {};
    }
}

function loadSchedule() {
    const monthKey =
        currentMonthKey();

    const rawValue =
        localStorage.getItem(
            storageKeyForMonth(monthKey)
        );

    if (rawValue !== null) {
        return parseMonthScheduleValue(
            rawValue,
            monthKey
        );
    }

    return loadLegacyMonthSchedule(
        monthKey
    );
}

function saveMonthSchedule(
    monthKey,
    monthSchedule
) {
    try {
        const normalized =
            normalizeMonthSchedule(
                monthSchedule,
                monthKey
            );

        const storageKey =
            storageKeyForMonth(monthKey);

        if (
            Object.keys(normalized).length === 0
        ) {
            localStorage.removeItem(
                storageKey
            );
        } else {
            localStorage.setItem(
                storageKey,
                JSON.stringify(normalized)
            );
        }

        return true;
    } catch (error) {
        console.error(
            "Грешка при запис на месец " +
                monthKey +
                " в localStorage:",
            error
        );

        return false;
    }
}

function saveSchedule() {
    return saveMonthSchedule(
        currentMonthKey(),
        schedule
    );
}

function migrateLegacySchedule() {
    const legacyRaw =
        localStorage.getItem(
            LEGACY_STORAGE_KEY
        );

    if (!legacyRaw) {
        return true;
    }

    const previousMonthValues =
        new Map();

    const affectedMonthKeys = [];
    let legacyWasRemoved = false;

    try {
        const parsed =
            JSON.parse(legacyRaw);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
        ) {
            return false;
        }

        const grouped =
            new Map();

        Object.entries(parsed).forEach(
            function (
                [dateKey, dayData]
            ) {
                const date =
                    keyToDate(dateKey);

                if (
                    !date ||
                    date < today
                ) {
                    return;
                }

                const monthKey =
                    monthKeyFromDateKey(
                        dateKey
                    );

                if (
                    !grouped.has(monthKey)
                ) {
                    grouped.set(
                        monthKey,
                        {}
                    );
                }

                grouped.get(monthKey)[dateKey] =
                    normalizeDay(dayData);
            }
        );

        grouped.forEach(
            function (
                unused,
                monthKey
            ) {
                const key =
                    storageKeyForMonth(
                        monthKey
                    );

                previousMonthValues.set(
                    monthKey,
                    localStorage.getItem(key)
                );

                affectedMonthKeys.push(
                    monthKey
                );
            }
        );

        localStorage.removeItem(
            LEGACY_STORAGE_KEY
        );

        legacyWasRemoved = true;

        for (
            const [monthKey, legacyMonth]
            of grouped
        ) {
            const existingMonth =
                parseMonthScheduleValue(
                    previousMonthValues.get(
                        monthKey
                    ),
                    monthKey
                );

            const merged = {
                ...legacyMonth,
                ...existingMonth
            };

            if (
                !saveMonthSchedule(
                    monthKey,
                    merged
                )
            ) {
                throw new Error(
                    "Миграцията на " +
                        monthKey +
                        " беше неуспешна."
                );
            }
        }

        return true;
    } catch (error) {
        console.error(
            "Грешка при разделяне на старите данни по месеци:",
            error
        );

        if (legacyWasRemoved) {
            try {
                affectedMonthKeys.forEach(
                    function (monthKey) {
                        localStorage.removeItem(
                            storageKeyForMonth(
                                monthKey
                            )
                        );
                    }
                );

                affectedMonthKeys.forEach(
                    function (monthKey) {
                        const oldValue =
                            previousMonthValues.get(
                                monthKey
                            );

                        if (oldValue !== null) {
                            localStorage.setItem(
                                storageKeyForMonth(
                                    monthKey
                                ),
                                oldValue
                            );
                        }
                    }
                );

                localStorage.setItem(
                    LEGACY_STORAGE_KEY,
                    legacyRaw
                );
            } catch (restoreError) {
                console.error(
                    "Старите данни не можаха да бъдат възстановени:",
                    restoreError
                );
            }
        }

        return false;
    }
}

function cleanupExpiredMonthStorage() {
    const currentKey =
        monthKeyFromParts(
            today.getFullYear(),
            today.getMonth()
        );

    const keysToRemove = [];

    for (
        let index = 0;
        index < localStorage.length;
        index++
    ) {
        const key =
            localStorage.key(index);

        if (
            !key ||
            !key.startsWith(
                STORAGE_KEY_PREFIX
            )
        ) {
            continue;
        }

        const monthKey =
            key.slice(
                STORAGE_KEY_PREFIX.length
            );

        if (
            /^\d{4}-\d{2}$/.test(monthKey) &&
            monthKey < currentKey
        ) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(
        function (key) {
            localStorage.removeItem(key);
        }
    );
}

function cleanupPastDays() {
    let changed = false;

    Object.keys(schedule).forEach(
        function (dateKey) {
            const date =
                keyToDate(dateKey);

            if (
                !date ||
                date < today
            ) {
                delete schedule[dateKey];
                changed = true;
            }
        }
    );

    if (changed) {
        saveSchedule();
    }
}

function getDayFromSchedule(
    monthSchedule,
    dateKey
) {
    if (!monthSchedule[dateKey]) {
        monthSchedule[dateKey] = {
            dayName: "",
            bookings: []
        };
    }

    monthSchedule[dateKey] =
        normalizeDay(
            monthSchedule[dateKey]
        );

    return monthSchedule[dateKey];
}

function getDay(dateKey) {
    return getDayFromSchedule(
        schedule,
        dateKey
    );
}

function peekDay(dateKey) {
    if (schedule[dateKey]) {
        return normalizeDay(
            schedule[dateKey]
        );
    }

    return {
        dayName: "",
        bookings: []
    };
}

function studentIdentityKey(
    dateKey,
    booking
) {
    const facultyNumber =
        comparable(
            booking.facultyNumber
        );

    if (!facultyNumber) {
        return null;
    }

    return [
        dateKey,
        comparable(booking.university),
        facultyNumber
    ].join("|");
}

function bookingColor(
    booking,
    index
) {
    const text =
        String(booking.id) +
        booking.firstName +
        booking.lastName;

    let hash = 0;

    for (
        const character
        of text
    ) {
        hash =
            (
                (hash << 5) -
                hash +
                character.charCodeAt(0)
            ) |
            0;
    }

    return BOOKING_COLORS[
        Math.abs(hash + index) %
        BOOKING_COLORS.length
    ];
}

function occupancyClass(count) {
    if (count === 0) {
        return "free-day";
    }

    if (count <= 3) {
        return "low-booked";
    }

    if (count <= 7) {
        return "medium-booked";
    }

    return "full-booked";
}

function formatMonth(
    year,
    month
) {
    const value =
        new Intl.DateTimeFormat(
            "bg-BG",
            {
                month: "long",
                year: "numeric"
            }
        ).format(
            new Date(
                year,
                month,
                1
            )
        );

    return (
        value
            .charAt(0)
            .toLocaleUpperCase(
                "bg-BG"
            ) +
        value.slice(1)
    );
}

function formatDate(date) {
    return new Intl.DateTimeFormat(
        "bg-BG",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    ).format(date);
}

function populateTimeOptions() {
    const startFragment =
        document.createDocumentFragment();

    const endFragment =
        document.createDocumentFragment();

    for (
        let minutes = DAY_START;
        minutes <= DAY_END;
        minutes += 30
    ) {
        const time =
            minutesToTime(minutes);

        const startOption =
            document.createElement(
                "option"
            );

        startOption.value =
            time;

        startOption.textContent =
            time;

        startOption.disabled =
            minutes === DAY_END;

        startFragment.appendChild(
            startOption
        );

        const endOption =
            document.createElement(
                "option"
            );

        endOption.value =
            time;

        endOption.textContent =
            time;

        endOption.disabled =
            minutes === DAY_START;

        endFragment.appendChild(
            endOption
        );
    }

    startTimeInput.replaceChildren(
        startFragment
    );

    endTimeInput.replaceChildren(
        endFragment
    );

    startTimeInput.value =
        DEFAULT_START_TIME;

    endTimeInput.value =
        "09:30";
}

function setFormDisabled(disabled) {
    [
        dayNameInput,
        startTimeInput,
        endTimeInput,
        hoursForTheDayInput,
        firstNameInput,
        lastNameInput,
        facultyNumberInput,
        universityInput,
        mentorInput,
        saveBtn
    ].forEach(
        function (element) {
            element.disabled =
                disabled;
        }
    );

    studentForm.classList.toggle(
        "disabled-form",
        disabled
    );
}

function showFormMessage(
    message = "",
    type = ""
) {
    formMessage.textContent =
        message;

    formMessage.className =
        "form-message";

    if (type) {
        formMessage.classList.add(type);
    }
}

function showBulkMessage(
    message = "",
    type = ""
) {
    bulkMessage.textContent =
        message;

    bulkMessage.className =
        "bulk-message";

    if (type) {
        bulkMessage.classList.add(type);
    }
}

function clearStudentFields() {
    dayNameInput.value =
        selectedDate
            ? peekDay(selectedDate).dayName
            : "";

    startTimeInput.value =
        DEFAULT_START_TIME;

    endTimeInput.value =
        "09:30";

    hoursForTheDayInput.value =
        "0.5";

    firstNameInput.value = "";
    lastNameInput.value = "";
    facultyNumberInput.value = "";
    universityInput.value = "";
    mentorInput.value = "";
}

function updateFormMode() {
    const isEditing =
        editingId !== null;

    formTitle.textContent =
        isEditing
            ? "Редактиране на студент"
            : "Добавяне на студент";

    saveBtn.textContent =
        isEditing
            ? "Запази промените"
            : "Потвърди";

    cancelEditBtn.hidden =
        !isEditing;

    setFormDisabled(
        !selectedDate
    );
}

function syncDetailsHeight() {
    if (
        window.matchMedia(
            "(max-width: 1250px)"
        ).matches
    ) {
        detailsBox.style.height = "";
        return;
    }

    const height =
        calendarBox
            .getBoundingClientRect()
            .height;

    if (height > 0) {
        detailsBox.style.height =
            Math.round(height) +
            "px";
    }
}

function renderCalendar() {
    monthTitle.textContent =
        formatMonth(
            currentYear,
            currentMonth
        );

    prevMonthBtn.disabled =
        currentYear === today.getFullYear() &&
        currentMonth === today.getMonth();

    calendarDays.replaceChildren();

    const firstDay =
        new Date(
            currentYear,
            currentMonth,
            1
        );

    const daysInMonth =
        new Date(
            currentYear,
            currentMonth + 1,
            0
        ).getDate();

    const emptyCells =
        (
            firstDay.getDay() +
            6
        ) %
        7;

    for (
        let index = 0;
        index < emptyCells;
        index++
    ) {
        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "day empty";

        calendarDays.appendChild(
            empty
        );
    }

    for (
        let dayNumber = 1;
        dayNumber <= daysInMonth;
        dayNumber++
    ) {
        const date =
            new Date(
                currentYear,
                currentMonth,
                dayNumber
            );

        date.setHours(
            0,
            0,
            0,
            0
        );

        const dateKey =
            dateToKey(date);

        const dayData =
            peekDay(dateKey);

        const unavailable =
            isUnavailable(date);

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "day";

        button.dataset.date =
            dateKey;

        if (unavailable) {
            button.classList.add(
                "unavailable-day"
            );

            button.disabled =
                true;
        } else {
            button.classList.add(
                occupancyClass(
                    dayData.bookings.length
                )
            );
        }

        if (
            date.getTime() ===
            today.getTime()
        ) {
            button.classList.add(
                "today"
            );
        }

        if (
            selectedDate ===
            dateKey
        ) {
            button.classList.add(
                "selected"
            );
        }

        const number =
            document.createElement(
                "span"
            );

        number.className =
            "day-number";

        number.textContent =
            String(dayNumber);

        const status =
            document.createElement(
                "small"
            );

        if (unavailable) {
            status.textContent =
                "Недостъпен";
        } else if (
            dayData.bookings.length === 0
        ) {
            status.textContent =
                "Свободен";
        } else {
            status.textContent =
                dayData.bookings.length +
                "/" +
                MAX_STUDENTS_PER_DAY +
                " студенти";
        }

        button.append(
            number,
            status
        );

        if (
            !unavailable &&
            dayData.dayName
        ) {
            const plan =
                document.createElement(
                    "small"
                );

            plan.className =
                "day-name-label";

            plan.textContent =
                dayData.dayName;

            button.appendChild(plan);
        }

        if (!unavailable) {
            button.addEventListener(
                "click",
                function () {
                    selectDate(dateKey);
                }
            );
        }

        calendarDays.appendChild(
            button
        );
    }

    requestAnimationFrame(
        syncDetailsHeight
    );
}

function selectDate(dateKey) {
    const date =
        keyToDate(dateKey);

    if (
        !date ||
        isUnavailable(date)
    ) {
        return;
    }

    selectedDate =
        dateKey;

    editingId =
        null;

    selectedDateText.textContent =
        formatDate(date);

    clearStudentFields();
    showFormMessage();
    updateFormMode();
    renderSidePreview(dateKey);
    renderCalendar();
}

function resetSelection() {
    selectedDate = null;
    editingId = null;

    selectedDateText.textContent =
        "Изберете работен ден от календара.";

    sidePreview.innerHTML =
        '<p class="empty-text">Изберете ден, за да видите дневния график и записаните студенти.</p>';

    clearStudentFields();
    showFormMessage();
    updateFormMode();
}

function createTimeScale() {
    const scale =
        document.createElement(
            "div"
        );

    scale.className =
        "time-scale";

    for (
        let minutes = DAY_START;
        minutes <= DAY_END;
        minutes += 60
    ) {
        const label =
            document.createElement(
                "div"
            );

        label.className =
            "time-cell";

        const ratio =
            (
                minutes -
                DAY_START
            ) /
            (
                DAY_END -
                DAY_START
            );

        label.style.top =
            (
                TIMELINE_HEADER_HEIGHT +
                ratio *
                TIMELINE_BODY_HEIGHT
            ) +
            "px";

        label.textContent =
            minutesToTime(minutes);

        scale.appendChild(label);
    }

    return scale;
}

function tooltipRow(
    label,
    value
) {
    const row =
        document.createElement(
            "div"
        );

    row.className =
        "tooltip-row";

    const labelElement =
        document.createElement(
            "span"
        );

    labelElement.className =
        "tooltip-label";

    labelElement.textContent =
        label;

    const valueElement =
        document.createElement(
            "span"
        );

    valueElement.className =
        "tooltip-value";

    valueElement.textContent =
        value || "—";

    row.append(
        labelElement,
        valueElement
    );

    return row;
}

function createPersonColumn(
    booking,
    index
) {
    const column =
        document.createElement(
            "div"
        );

    column.className =
        "person-column";

    const name =
        document.createElement(
            "div"
        );

    name.className =
        "person-name";

    name.textContent =
        booking.firstName +
        " " +
        booking.lastName;

    name.title =
        name.textContent;

    const body =
        document.createElement(
            "div"
        );

    body.className =
        "column-body";

    const start =
        timeToMinutes(
            booking.startTime
        );

    const end =
        timeToMinutes(
            booking.endTime
        );

    if (
        start !== null &&
        end !== null &&
        end > start
    ) {
        const visibleStart =
            Math.max(
                DAY_START,
                start
            );

        const visibleEnd =
            Math.min(
                DAY_END,
                end
            );

        if (
            visibleEnd >
            visibleStart
        ) {
            const block =
                document.createElement(
                    "button"
                );

            block.type =
                "button";

            block.className =
                "busy-block";

            const topRatio =
                (
                    visibleStart -
                    DAY_START
                ) /
                (
                    DAY_END -
                    DAY_START
                );

            const heightRatio =
                (
                    visibleEnd -
                    visibleStart
                ) /
                (
                    DAY_END -
                    DAY_START
                );

            block.style.top =
                (
                    topRatio *
                    TIMELINE_BODY_HEIGHT
                ) +
                "px";

            block.style.height =
                Math.max(
                    heightRatio *
                    TIMELINE_BODY_HEIGHT,
                    22
                ) +
                "px";

            block.style.setProperty(
                "--booking-color",
                bookingColor(
                    booking,
                    index
                )
            );

            block.setAttribute(
                "aria-label",
                booking.firstName +
                " " +
                booking.lastName +
                ", " +
                booking.startTime +
                "–" +
                booking.endTime
            );

            const timeText =
                document.createElement(
                    "span"
                );

            timeText.className =
                "busy-time-text";

            timeText.textContent =
                booking.startTime +
                "–" +
                booking.endTime;

            const tooltip =
                document.createElement(
                    "span"
                );

            tooltip.className =
                "student-tooltip";

            const tooltipName =
                document.createElement(
                    "strong"
                );

            tooltipName.className =
                "tooltip-name";

            tooltipName.textContent =
                booking.firstName +
                " " +
                booking.lastName;

            tooltip.append(
                tooltipName,

                tooltipRow(
                    "Час",
                    booking.startTime +
                    "–" +
                    booking.endTime
                ),

                tooltipRow(
                    "Часове",
                    String(
                        booking.HoursForTheDay
                    )
                ),

                tooltipRow(
                    "Фак. №",
                    booking.facultyNumber
                ),

                tooltipRow(
                    "Университет",
                    booking.university
                ),

                tooltipRow(
                    "Наставник",
                    booking.mentor
                )
            );

            block.append(
                timeText,
                tooltip
            );

            body.appendChild(block);
        }
    }

    column.append(
        name,
        body
    );

    return column;
}

function createBookingCard(
    booking,
    index
) {
    const card =
        document.createElement(
            "article"
        );

    card.className =
        "preview-booking-card";

    card.style.borderLeftColor =
        bookingColor(
            booking,
            index
        );

    const name =
        document.createElement(
            "strong"
        );

    name.textContent =
        booking.firstName +
        " " +
        booking.lastName;

    const time =
        document.createElement(
            "span"
        );

    time.textContent =
        "Час: " +
        booking.startTime +
        "–" +
        booking.endTime +
        " (" +
        booking.HoursForTheDay +
        " ч.)";

    const faculty =
        document.createElement(
            "small"
        );

    faculty.textContent =
        "Факултетен номер: " +
        (
            booking.facultyNumber ||
            "—"
        );

    const university =
        document.createElement(
            "small"
        );

    university.textContent =
        "Университет: " +
        (
            booking.university ||
            "—"
        );

    const mentor =
        document.createElement(
            "small"
        );

    mentor.textContent =
        "Наставник: " +
        (
            booking.mentor ||
            "—"
        );

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "slot-actions";

    const editButton =
        document.createElement(
            "button"
        );

    editButton.type =
        "button";

    editButton.className =
        "edit-booking-btn";

    editButton.dataset.id =
        booking.id;

    editButton.textContent =
        "Редактирай";

    const deleteButton =
        document.createElement(
            "button"
        );

    deleteButton.type =
        "button";

    deleteButton.className =
        "delete-booking-btn";

    deleteButton.dataset.id =
        booking.id;

    deleteButton.textContent =
        "Премахни";

    actions.append(
        editButton,
        deleteButton
    );

    card.append(
        name,
        time,
        faculty,
        university,
        mentor,
        actions
    );

    return card;
}

function renderSidePreview(dateKey) {
    const date =
        keyToDate(dateKey);

    if (!date) {
        return;
    }

    const dayData =
        peekDay(dateKey);

    const bookings =
        [...dayData.bookings]
            .sort(
                function (
                    first,
                    second
                ) {
                    return (
                        timeToMinutes(
                            first.startTime
                        ) -
                        timeToMinutes(
                            second.startTime
                        ) ||
                        first.firstName
                            .localeCompare(
                                second.firstName,
                                "bg-BG"
                            ) ||
                        first.lastName
                            .localeCompare(
                                second.lastName,
                                "bg-BG"
                            )
                    );
                }
            );

    sidePreview.replaceChildren();

    const plan =
        document.createElement(
            "h3"
        );

    plan.textContent =
        dayData.dayName ||
        "Няма зададен план за деня";

    sidePreview.appendChild(plan);

    if (
        bookings.length === 0
    ) {
        const empty =
            document.createElement(
                "p"
            );

        empty.className =
            "empty-text";

        empty.textContent =
            "За този ден няма записани студенти.";

        sidePreview.appendChild(empty);

        return;
    }

    const timelineSection =
        document.createElement(
            "section"
        );

    timelineSection.className =
        "timeline-section";

    const timelineHeader =
        document.createElement(
            "div"
        );

    timelineHeader.className =
        "timeline-section-title";

    const timelineTitle =
        document.createElement(
            "h4"
        );

    timelineTitle.textContent =
        "Дневен график";

    const timelineCount =
        document.createElement(
            "span"
        );

    timelineCount.textContent =
        bookings.length +
        "/" +
        MAX_STUDENTS_PER_DAY +
        " студенти";

    timelineHeader.append(
        timelineTitle,
        timelineCount
    );

    const timeline =
        document.createElement(
            "div"
        );

    timeline.className =
        "timeline";

    const timelineWrapper =
        document.createElement(
            "div"
        );

    timelineWrapper.className =
        "timeline-wrapper";

    const peopleGrid =
        document.createElement(
            "div"
        );

    peopleGrid.className =
        "people-grid";

    peopleGrid.style.setProperty(
        "--student-count",
        String(
            Math.max(
                bookings.length,
                1
            )
        )
    );

    bookings.forEach(
        function (
            booking,
            index
        ) {
            peopleGrid.appendChild(
                createPersonColumn(
                    booking,
                    index
                )
            );
        }
    );

    timelineWrapper.append(
        createTimeScale(),
        peopleGrid
    );

    timeline.appendChild(
        timelineWrapper
    );

    timelineSection.append(
        timelineHeader,
        timeline
    );

    const bookingsSection =
        document.createElement(
            "section"
        );

    bookingsSection.className =
        "bookings-section";

    const bookingsHeader =
        document.createElement(
            "div"
        );

    bookingsHeader.className =
        "bookings-section-header";

    const bookingsTitle =
        document.createElement(
            "h4"
        );

    bookingsTitle.textContent =
        "Записани студенти";

    const bookingsCount =
        document.createElement(
            "span"
        );

    bookingsCount.textContent =
        String(bookings.length);

    bookingsHeader.append(
        bookingsTitle,
        bookingsCount
    );

    const bookingList =
        document.createElement(
            "div"
        );

    bookingList.className =
        "booking-list";

    bookings.forEach(
        function (
            booking,
            index
        ) {
            bookingList.appendChild(
                createBookingCard(
                    booking,
                    index
                )
            );
        }
    );

    bookingsSection.append(
        bookingsHeader,
        bookingList
    );

    sidePreview.append(
        timelineSection,
        bookingsSection
    );
}

function validateForm(dayData) {
    const firstName =
        clean(firstNameInput.value);

    const lastName =
        clean(lastNameInput.value);

    const mentor =
        clean(mentorInput.value);

    const start =
        timeToMinutes(
            startTimeInput.value
        );

    const end =
        timeToMinutes(
            endTimeInput.value
        );

    const hours =
        parseHours(
            hoursForTheDayInput.value
        );

    if (!firstName) {
        return "Въведете име.";
    }

    if (!lastName) {
        return "Въведете фамилия.";
    }

    if (!mentor) {
        return "Въведете наставник.";
    }

    if (
        start === null ||
        end === null ||
        start < DAY_START ||
        end > DAY_END ||
        end <= start
    ) {
        return "Изберете валиден часови диапазон между 08:00 и 18:00.";
    }

    if (
        hours === null ||
        hours < 0.5 ||
        hours > 10 ||
        Math.abs(
            hours * 2 -
            Math.round(hours * 2)
        ) >
            0.0001
    ) {
        return "Часовете за деня трябва да са от 0.5 до 10 през стъпка 0.5.";
    }

    const calculatedHours =
        hoursBetween(
            startTimeInput.value,
            endTimeInput.value
        );

    if (
        calculatedHours === null ||
        Math.abs(
            calculatedHours -
            hours
        ) >
            0.0001
    ) {
        return "Часовият диапазон не съвпада с въведените часове за деня.";
    }

    if (
        editingId === null &&
        dayData.bookings.length >=
            MAX_STUDENTS_PER_DAY
    ) {
        return "За този ден вече са добавени максималните 10 студенти.";
    }

    return "";
}

function findBooking(
    dateKey,
    id
) {
    return (
        getDay(dateKey)
            .bookings
            .find(
                function (booking) {
                    return (
                        String(booking.id) ===
                        String(id)
                    );
                }
            ) ||
        null
    );
}

studentForm.addEventListener(
    "submit",
    function (event) {
        event.preventDefault();

        if (!selectedDate) {
            showFormMessage(
                "Изберете дата.",
                "error"
            );

            return;
        }

        const dayData =
            getDay(selectedDate);

        const validationError =
            validateForm(dayData);

        if (validationError) {
            showFormMessage(
                validationError,
                "error"
            );

            return;
        }

        const backup =
            JSON.parse(
                JSON.stringify(schedule)
            );

        const wasEditing =
            editingId !== null;

        dayData.dayName =
            clean(dayNameInput.value);

        const bookingData = {
            firstName:
                clean(
                    firstNameInput.value
                ),

            lastName:
                clean(
                    lastNameInput.value
                ),

            facultyNumber:
                clean(
                    facultyNumberInput.value
                ),

            university:
                clean(
                    universityInput.value
                ),

            startTime:
                startTimeInput.value,

            endTime:
                endTimeInput.value,

            HoursForTheDay:
                parseHours(
                    hoursForTheDayInput.value
                ),

            mentor:
                clean(
                    mentorInput.value
                )
        };

        if (wasEditing) {
            const booking =
                findBooking(
                    selectedDate,
                    editingId
                );

            if (!booking) {
                showFormMessage(
                    "Записът не съществува.",
                    "error"
                );

                return;
            }

            const identityKey =
                studentIdentityKey(
                    selectedDate,
                    bookingData
                );

            const duplicate =
                identityKey !== null &&
                dayData.bookings.some(
                    function (item) {
                        return (
                            String(item.id) !==
                                String(editingId) &&
                            studentIdentityKey(
                                selectedDate,
                                item
                            ) ===
                                identityKey
                        );
                    }
                );

            if (duplicate) {
                showFormMessage(
                    "Студент със същия факултетен номер вече е добавен за този ден.",
                    "error"
                );

                return;
            }

            Object.assign(
                booking,
                bookingData
            );

            editingId = null;
        } else {
            const identityKey =
                studentIdentityKey(
                    selectedDate,
                    bookingData
                );

            const duplicate =
                identityKey !== null &&
                dayData.bookings.some(
                    function (booking) {
                        return (
                            studentIdentityKey(
                                selectedDate,
                                booking
                            ) ===
                            identityKey
                        );
                    }
                );

            if (duplicate) {
                showFormMessage(
                    "Студент със същия факултетен номер вече е добавен за този ден.",
                    "error"
                );

                return;
            }

            dayData.bookings.push({
                id: createId(),
                ...bookingData
            });
        }

        if (!saveSchedule()) {
            schedule = backup;

            showFormMessage(
                "Записът в localStorage беше неуспешен. Промените не са запазени.",
                "error"
            );

            return;
        }

        showFormMessage(
            wasEditing
                ? "Записът е редактиран."
                : "Студентът е добавен.",
            "success"
        );

        clearStudentFields();
        updateFormMode();

        renderSidePreview(
            selectedDate
        );

        renderCalendar();
    }
);

function startEditBooking(id) {
    if (!selectedDate) {
        return;
    }

    const booking =
        findBooking(
            selectedDate,
            id
        );

    if (!booking) {
        return;
    }

    editingId = id;

    dayNameInput.value =
        peekDay(selectedDate).dayName;

    startTimeInput.value =
        booking.startTime;

    endTimeInput.value =
        booking.endTime;

    hoursForTheDayInput.value =
        booking.HoursForTheDay;

    firstNameInput.value =
        booking.firstName;

    lastNameInput.value =
        booking.lastName;

    facultyNumberInput.value =
        booking.facultyNumber;

    universityInput.value =
        booking.university;

    mentorInput.value =
        booking.mentor;

    updateFormMode();

    studentForm.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

function removeBooking(id) {
    if (!selectedDate) {
        return;
    }

    const dayData =
        getDay(selectedDate);

    const booking =
        dayData.bookings.find(
            function (item) {
                return (
                    String(item.id) ===
                    String(id)
                );
            }
        );

    if (!booking) {
        return;
    }

    const confirmed =
        confirm(
            "Сигурни ли сте, че искате да премахнете " +
            booking.firstName +
            " " +
            booking.lastName +
            "?"
        );

    if (!confirmed) {
        return;
    }

    const backup =
        JSON.parse(
            JSON.stringify(schedule)
        );

    dayData.bookings =
        dayData.bookings.filter(
            function (item) {
                return (
                    String(item.id) !==
                    String(id)
                );
            }
        );

    if (
        String(editingId) ===
        String(id)
    ) {
        editingId = null;

        clearStudentFields();
        updateFormMode();
    }

    if (!saveSchedule()) {
        schedule = backup;

        showFormMessage(
            "Записът не беше премахнат, защото localStorage не можа да бъде обновен.",
            "error"
        );

        return;
    }

    renderSidePreview(
        selectedDate
    );

    renderCalendar();
}

sidePreview.addEventListener(
    "click",
    function (event) {
        const editButton =
            event.target.closest(
                ".edit-booking-btn"
            );

        const deleteButton =
            event.target.closest(
                ".delete-booking-btn"
            );

        if (editButton) {
            startEditBooking(
                editButton.dataset.id
            );

            return;
        }

        if (deleteButton) {
            removeBooking(
                deleteButton.dataset.id
            );
        }
    }
);

function splitBulkRecords(source) {
    const records = [];

    let start = 0;
    let inQuotes = false;

    function addRecord(
        rawStart,
        rawEnd
    ) {
        let contentStart =
            rawStart;

        let contentEnd =
            rawEnd;

        while (
            contentStart <
                contentEnd &&
            /\s/.test(
                source[contentStart]
            )
        ) {
            contentStart++;
        }

        while (
            contentEnd >
                contentStart &&
            /\s/.test(
                source[
                    contentEnd - 1
                ]
            )
        ) {
            contentEnd--;
        }

        if (
            contentStart <
            contentEnd
        ) {
            records.push({
                start:
                    contentStart,

                end:
                    contentEnd,

                text:
                    source.slice(
                        contentStart,
                        contentEnd
                    )
            });
        }
    }

    for (
        let index = 0;
        index < source.length;
        index++
    ) {
        const character =
            source[index];

        if (character === '"') {
            if (
                inQuotes &&
                source[index + 1] === '"'
            ) {
                index++;
            } else {
                inQuotes =
                    !inQuotes;
            }

            continue;
        }

        if (
            !inQuotes &&
            (
                character === ";" ||
                character === "\n" ||
                character === "\r"
            )
        ) {
            addRecord(
                start,
                index
            );

            if (
                character === "\r" &&
                source[index + 1] === "\n"
            ) {
                index++;
            }

            start =
                index + 1;
        }
    }

    addRecord(
        start,
        source.length
    );

    return {
        source,
        records
    };
}

function parseFields(recordText) {
    let text =
        String(recordText)
            .replace(
                /^```[\w-]*\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            )
            .replace(
                /^\s*(?:[-*•]\s+|\d+[.)]\s+)/,
                ""
            )
            .trim();

    if (!text) {
        return [];
    }

    if (
        text.startsWith("|") &&
        text.endsWith("|")
    ) {
        return text
            .slice(1, -1)
            .split("|")
            .map(clean);
    }

    if (
        text.includes("\t") &&
        !text.includes(",")
    ) {
        return text
            .split("\t")
            .map(clean);
    }

    if (
        text.includes("|") &&
        !text.includes(",")
    ) {
        return text
            .split("|")
            .map(clean);
    }

    const fields = [];

    let current = "";
    let inQuotes = false;

    for (
        let index = 0;
        index < text.length;
        index++
    ) {
        const character =
            text[index];

        if (character === '"') {
            if (
                inQuotes &&
                text[index + 1] === '"'
            ) {
                current += '"';
                index++;
            } else {
                inQuotes =
                    !inQuotes;
            }

            continue;
        }

        if (
            character === "," &&
            !inQuotes
        ) {
            fields.push(
                clean(current)
            );

            current = "";
            continue;
        }

        current += character;
    }

    fields.push(
        clean(current)
    );

    return fields;
}

function isHeader(fields) {
    const text =
        fields
            .map(
                function (field) {
                    return comparable(field)
                        .replace(
                            /[№._-]/g,
                            " "
                        );
                }
            )
            .join(" ");

    const words = [
        "име",
        "фамилия",
        "университет",
        "часове",
        "наставник"
    ];

    const foundWords =
        words.filter(
            function (word) {
                return text.includes(word);
            }
        );

    return foundWords.length >= 3;
}

function isMarkdownSeparator(fields) {
    return (
        fields.length > 0 &&
        fields.every(
            function (field) {
                return /^:?-{3,}:?$/
                    .test(
                        field.replace(
                            /\s/g,
                            ""
                        )
                    );
            }
        )
    );
}

function repairExtraFields(fields) {
    if (fields.length <= 7) {
        return fields.map(clean);
    }

    const cleaned =
        fields.map(clean);

    const hasDate =
        parseDate(cleaned[0]) !== null;

    let expected = 5;

    if (hasDate) {
        expected =
            parseHours(cleaned[4]) !== null
                ? 6
                : 7;
    }

    return [
        ...cleaned.slice(
            0,
            expected - 1
        ),

        cleaned
            .slice(expected - 1)
            .join(", ")
    ];
}

function parseBulkRecord(
    recordText,
    recordNumber
) {
    let fields =
        parseFields(recordText);

    if (
        !fields.length ||
        fields.every(
            function (field) {
                return !field;
            }
        )
    ) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": празен запис."
        };
    }

    if (
        isHeader(fields) ||
        isMarkdownSeparator(fields)
    ) {
        return {
            type: "header"
        };
    }

    fields =
        repairExtraFields(fields);

    let dateKey = null;
    let dayName = "";
    let firstName = "";
    let lastName = "";
    let university = "";
    let hoursValue = "";
    let mentor = "";

    const explicitDate =
        parseDate(fields[0]);

    if (explicitDate) {
        dateKey =
            dateToKey(explicitDate);

        if (fields.length === 6) {
            [
                firstName,
                lastName,
                university,
                hoursValue,
                mentor
            ] = fields.slice(1);
        } else if (
            fields.length === 7
        ) {
            [
                dayName,
                firstName,
                lastName,
                university,
                hoursValue,
                mentor
            ] = fields.slice(1);
        } else {
            return {
                type: "error",

                message:
                    "Запис " +
                    recordNumber +
                    ": при посочена дата се очакват 6 полета или 7 полета с план, а са намерени " +
                    fields.length +
                    "."
            };
        }
    } else if (
        fields.length === 5
    ) {
        if (!selectedDate) {
            return {
                type: "error",

                message:
                    "Запис " +
                    recordNumber +
                    ": липсва дата. Избери ден от календара или добави дата във формат YYYY-MM-DD."
            };
        }

        dateKey =
            selectedDate;

        [
            firstName,
            lastName,
            university,
            hoursValue,
            mentor
        ] = fields;
    } else {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": очакват се 5 полета за избрания ден, 6 полета с дата или 7 полета с дата и план, а са намерени " +
                fields.length +
                "."
        };
    }

    const date =
        keyToDate(dateKey);

    if (!date) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": липсва или е невалидна дата."
        };
    }

    if (date < today) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": датата е в миналото."
        };
    }

    if (isWeekend(date)) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": събота и неделя са недостъпни."
        };
    }

    if (!clean(firstName)) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": липсва име."
        };
    }

    if (!clean(lastName)) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": липсва фамилия."
        };
    }

    if (!clean(mentor)) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": липсва наставник."
        };
    }

    const hours =
        parseHours(hoursValue);

    if (
        hours === null ||
        hours < 0.5 ||
        hours > 9 ||
        Math.abs(
            hours * 2 -
            Math.round(hours * 2)
        ) >
            0.0001
    ) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": часовете трябва да са от 0.5 до 9 през стъпка 0.5."
        };
    }

    const endTime =
        endTimeFromHours(
            DEFAULT_START_TIME,
            hours
        );

    if (!endTime) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": часовете излизат извън допустимия диапазон до 18:00."
        };
    }

    return {
        type: "student",

        recordNumber,

        dateKey,

        dayName:
            clean(dayName),

        booking: {
            id:
                createId(),

            firstName:
                clean(firstName),

            lastName:
                clean(lastName),

            facultyNumber: "",

            university:
                clean(university),

            startTime:
                DEFAULT_START_TIME,

            endTime,

            HoursForTheDay:
                hours,

            mentor:
                clean(mentor)
        }
    };
}

function clearBulkResult() {
    bulkResult.hidden =
        true;

    bulkAddedCount.textContent =
        "0";

    bulkSkippedCount.textContent =
        "0";

    bulkErrorCount.textContent =
        "0";

    bulkErrorList.replaceChildren();
}

function showBulkResult(result) {
    bulkAddedCount.textContent =
        String(result.added);

    bulkSkippedCount.textContent =
        String(result.skipped);

    bulkErrorCount.textContent =
        String(result.errors.length);

    bulkErrorList.replaceChildren();

    result.errors.forEach(
        function (message) {
            const item =
                document.createElement(
                    "li"
                );

            item.textContent =
                message;

            bulkErrorList.appendChild(item);
        }
    );

    bulkResult.hidden =
        false;
}

function clearBulkHighlights() {
    bulkHighlightLayer.textContent =
        "";

    bulkEditor.classList.remove(
        "has-results"
    );
}

function renderBulkHighlights(
    source,
    records,
    states
) {
    bulkHighlightLayer.replaceChildren();

    let cursor = 0;

    records.forEach(
        function (
            record,
            index
        ) {
            if (
                record.start >
                cursor
            ) {
                bulkHighlightLayer.append(
                    document.createTextNode(
                        source.slice(
                            cursor,
                            record.start
                        )
                    )
                );
            }

            const state =
                states.get(index + 1) ||
                "error";

            const span =
                document.createElement(
                    "span"
                );

            span.className =
                "bulk-record-highlight " +
                state;

            span.dataset.state =
                state;

            span.textContent =
                source.slice(
                    record.start,
                    record.end
                );

            bulkHighlightLayer.appendChild(
                span
            );

            cursor =
                record.end;
        }
    );

    if (
        cursor <
        source.length
    ) {
        bulkHighlightLayer.append(
            document.createTextNode(
                source.slice(cursor)
            )
        );
    }

    bulkEditor.classList.add(
        "has-results"
    );

    bulkHighlightLayer.scrollTop =
        bulkStudentsInput.scrollTop;

    bulkHighlightLayer.scrollLeft =
        bulkStudentsInput.scrollLeft;
}

function addStudentsFromList() {
    const rawText =
        bulkStudentsInput.value;

    showBulkMessage();
    clearBulkResult();
    clearBulkHighlights();

    if (!rawText.trim()) {
        showBulkMessage(
            "Поставете списък със студенти.",
            "error"
        );

        return;
    }

    const splitResult =
        splitBulkRecords(rawText);

    const source =
        splitResult.source;

    const records =
        splitResult.records;

    if (!records.length) {
        showBulkMessage(
            "Списъкът е празен.",
            "error"
        );

        return;
    }

    const result = {
        added: 0,
        skipped: 0,
        errors: []
    };

    const states =
        new Map();

    const parsedStudents = [];

    records.forEach(
        function (
            record,
            index
        ) {
            const recordNumber =
                index + 1;

            const parsed =
                parseBulkRecord(
                    record.text,
                    recordNumber
                );

            if (
                parsed.type ===
                "header"
            ) {
                result.skipped++;

                result.errors.push(
                    "Запис " +
                    recordNumber +
                    ": заглавният ред не се добавя."
                );

                states.set(
                    recordNumber,
                    "error"
                );

                return;
            }

            if (
                parsed.type ===
                "error"
            ) {
                result.errors.push(
                    parsed.message
                );

                states.set(
                    recordNumber,
                    "error"
                );

                return;
            }

            parsedStudents.push(parsed);
        }
    );

    const displayedMonthKey =
        currentMonthKey();

    const monthContexts =
        new Map();

    function getMonthContext(
        dateKey
    ) {
        const monthKey =
            monthKeyFromDateKey(
                dateKey
            );

        if (!monthKey) {
            return null;
        }

        if (
            monthContexts.has(
                monthKey
            )
        ) {
            return monthContexts.get(
                monthKey
            );
        }

        const storageKey =
            storageKeyForMonth(
                monthKey
            );

        const rawValue =
            localStorage.getItem(
                storageKey
            );

        const original =
            monthKey === displayedMonthKey
                ? JSON.parse(
                    JSON.stringify(schedule)
                )
                : parseMonthScheduleValue(
                    rawValue,
                    monthKey
                );

        const context = {
            monthKey,
            storageKey,
            rawValue,
            original,
            working:
                JSON.parse(
                    JSON.stringify(original)
                ),
            changed: false
        };

        monthContexts.set(
            monthKey,
            context
        );

        return context;
    }

    parsedStudents.forEach(
        function (parsed) {
            const context =
                getMonthContext(
                    parsed.dateKey
                );

            if (!context) {
                result.errors.push(
                    "Запис " +
                    parsed.recordNumber +
                    ": датата е невалидна."
                );

                states.set(
                    parsed.recordNumber,
                    "error"
                );

                return;
            }

            const dayData =
                getDayFromSchedule(
                    context.working,
                    parsed.dateKey
                );

            const identityKey =
                studentIdentityKey(
                    parsed.dateKey,
                    parsed.booking
                );

            const duplicate =
                identityKey !== null &&
                dayData.bookings.some(
                    function (booking) {
                        return (
                            studentIdentityKey(
                                parsed.dateKey,
                                booking
                            ) ===
                            identityKey
                        );
                    }
                );

            if (duplicate) {
                result.skipped++;

                result.errors.push(
                    "Запис " +
                    parsed.recordNumber +
                    ": студент със същия факултетен номер вече е добавен за " +
                    parsed.dateKey +
                    "."
                );

                states.set(
                    parsed.recordNumber,
                    "error"
                );

                return;
            }

            if (
                dayData.bookings.length >=
                MAX_STUDENTS_PER_DAY
            ) {
                result.skipped++;

                result.errors.push(
                    "Запис " +
                    parsed.recordNumber +
                    ": няма свободно място за " +
                    parsed.dateKey +
                    "."
                );

                states.set(
                    parsed.recordNumber,
                    "error"
                );

                return;
            }

            if (
                parsed.dayName &&
                !dayData.dayName
            ) {
                dayData.dayName =
                    parsed.dayName;
            }

            dayData.bookings.push(
                parsed.booking
            );

            context.changed = true;
            result.added++;

            states.set(
                parsed.recordNumber,
                "success"
            );
        }
    );

    if (result.added > 0) {
        const changedContexts =
            Array.from(
                monthContexts.values()
            ).filter(
                function (context) {
                    return context.changed;
                }
            );

        const savedContexts = [];
        let saveFailed = false;

        for (
            const context
            of changedContexts
        ) {
            if (
                !saveMonthSchedule(
                    context.monthKey,
                    context.working
                )
            ) {
                saveFailed = true;
                break;
            }

            savedContexts.push(context);
        }

        if (saveFailed) {
            savedContexts.forEach(
                function (context) {
                    try {
                        if (
                            context.rawValue === null
                        ) {
                            localStorage.removeItem(
                                context.storageKey
                            );
                        } else {
                            localStorage.setItem(
                                context.storageKey,
                                context.rawValue
                            );
                        }
                    } catch (error) {
                        console.error(
                            "Неуспешно възстановяване на месец " +
                                context.monthKey +
                                ":",
                            error
                        );
                    }
                }
            );

            parsedStudents.forEach(
                function (parsed) {
                    if (
                        states.get(
                            parsed.recordNumber
                        ) ===
                        "success"
                    ) {
                        states.set(
                            parsed.recordNumber,
                            "error"
                        );
                    }
                }
            );

            result.errors.push(
                "Записът в localStorage беше неуспешен. Данните не са добавени."
            );

            result.added = 0;

            showBulkMessage(
                "Данните не бяха запазени.",
                "error"
            );
        } else {
            const displayedContext =
                monthContexts.get(
                    displayedMonthKey
                );

            if (
                displayedContext &&
                displayedContext.changed
            ) {
                schedule =
                    displayedContext.working;
            }

            renderCalendar();

            if (selectedDate) {
                renderSidePreview(
                    selectedDate
                );
            }

            showBulkMessage(
                "Успешно добавени студенти: " +
                result.added +
                ". Неуспешните записи са маркирани в червено.",
                result.errors.length
                    ? "error"
                    : "success"
            );
        }
    } else {
        showBulkMessage(
            "Не бяха добавени нови студенти. Провери записите, маркирани в червено.",
            "error"
        );
    }

    records.forEach(
        function (
            record,
            index
        ) {
            if (
                !states.has(index + 1)
            ) {
                states.set(
                    index + 1,
                    "error"
                );
            }
        }
    );

    renderBulkHighlights(
        source,
        records,
        states
    );

    showBulkResult(result);
}

startTimeInput.addEventListener(
    "change",
    function () {
        const endTime =
            endTimeFromHours(
                startTimeInput.value,
                hoursForTheDayInput.value
            );

        if (endTime) {
            endTimeInput.value =
                endTime;
        }
    }
);

endTimeInput.addEventListener(
    "change",
    function () {
        const hours =
            hoursBetween(
                startTimeInput.value,
                endTimeInput.value
            );

        hoursForTheDayInput.value =
            hours === null
                ? ""
                : String(hours);
    }
);

hoursForTheDayInput.addEventListener(
    "input",
    function () {
        const endTime =
            endTimeFromHours(
                startTimeInput.value,
                hoursForTheDayInput.value
            );

        if (endTime) {
            endTimeInput.value =
                endTime;
        }
    }
);

addStudentsListBtn.addEventListener(
    "click",
    addStudentsFromList
);

bulkStudentsInput.addEventListener(
    "scroll",
    function () {
        bulkHighlightLayer.scrollTop =
            bulkStudentsInput.scrollTop;

        bulkHighlightLayer.scrollLeft =
            bulkStudentsInput.scrollLeft;
    }
);

bulkStudentsInput.addEventListener(
    "input",
    function () {
        clearBulkHighlights();
        clearBulkResult();
        showBulkMessage();
    }
);

clearStudentsListBtn.addEventListener(
    "click",
    function () {
        bulkStudentsInput.value = "";

        clearBulkHighlights();
        clearBulkResult();
        showBulkMessage();

        bulkStudentsInput.focus();
    }
);

cancelEditBtn.addEventListener(
    "click",
    function () {
        editingId = null;

        clearStudentFields();
        updateFormMode();
        showFormMessage();
    }
);

prevMonthBtn.addEventListener(
    "click",
    function () {
        const isCurrentMonth =
            currentYear === today.getFullYear() &&
            currentMonth === today.getMonth();

        if (isCurrentMonth) {
            return;
        }

        currentMonth--;

        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }

        const beforeCurrentMonth =
            currentYear < today.getFullYear() ||
            (
                currentYear === today.getFullYear() &&
                currentMonth < today.getMonth()
            );

        if (beforeCurrentMonth) {
            currentYear =
                today.getFullYear();

            currentMonth =
                today.getMonth();
        }

        schedule =
            loadSchedule();

        cleanupPastDays();
        resetSelection();
        renderCalendar();
    }
);

nextMonthBtn.addEventListener(
    "click",
    function () {
        currentMonth++;

        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }

        schedule =
            loadSchedule();

        cleanupPastDays();
        resetSelection();
        renderCalendar();
    }
);

copyPromptBtn.addEventListener(
    "click",
    async function () {
        try {
            await navigator
                .clipboard
                .writeText(GPT_PROMPT);
        } catch (error) {
            const textarea =
                document.createElement(
                    "textarea"
                );

            textarea.value =
                GPT_PROMPT;

            textarea.readOnly =
                true;

            textarea.style.position =
                "fixed";

            textarea.style.opacity =
                "0";

            document.body.appendChild(
                textarea
            );

            textarea.select();

            document.execCommand("copy");

            textarea.remove();
        }

        copyPromptBtn.textContent =
            "Копирано";

        copyPromptBtn.classList.add(
            "copied"
        );

        copyPromptStatus.textContent =
            "Prompt-ът е копиран.";

        setTimeout(
            function () {
                copyPromptBtn.textContent =
                    "Копирай prompt-а";

                copyPromptBtn.classList.remove(
                    "copied"
                );

                copyPromptStatus.textContent =
                    "";
            },
            2200
        );
    }
);

window.addEventListener(
    "storage",
    function (event) {
        const visibleStorageKey =
            storageKeyForMonth(
                currentMonthKey()
            );

        if (
            event.key !== null &&
            event.key !== visibleStorageKey
        ) {
            return;
        }

        schedule =
            loadSchedule();

        cleanupPastDays();

        if (selectedDate) {
            renderSidePreview(
                selectedDate
            );
        }

        renderCalendar();
    }
);

window.addEventListener(
    "resize",
    syncDetailsHeight
);

window.addEventListener(
    "pagehide",
    saveSchedule
);

document.addEventListener(
    "visibilitychange",
    function () {
        if (
            document.visibilityState ===
            "hidden"
        ) {
            saveSchedule();
        }
    }
);

if (
    typeof ResizeObserver ===
    "function"
) {
    const resizeObserver =
        new ResizeObserver(
            syncDetailsHeight
        );

    resizeObserver.observe(
        calendarBox
    );
}

cleanupPastDays();

populateTimeOptions();

setFormDisabled(true);

updateFormMode();

clearBulkResult();

renderCalendar();

syncDetailsHeight();