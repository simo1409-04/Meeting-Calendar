"use strict";

const STORAGE_KEY =
    "meetingCalendarScheduleV2";

const LEGACY_STORAGE_KEY =
    "schedule";

const MAX_STUDENTS_PER_DAY = 10;

const OPENING_HOUR = 8;
const CLOSING_HOUR = 18;

const TIMELINE_HEIGHT = 420;
const TIMELINE_HEADER_HEIGHT = 32;

const STUDENT_COLORS = [
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#dc2626",
    "#ea580c",
    "#ca8a04",
    "#16a34a",
    "#0891b2",
    "#0284c7",
    "#4f46e5"
];

const GPT_PROMPT = `Прочети студентите от screenshot-а и върни САМО данните в този формат, без обяснения:
Дата,План за деня,Име,Фамилия,Факултетен номер,Университет,От,До;

Правила:
- Данните за един студент се разделят със запетая.
- Отделните студенти се разделят с точка и запетая.
- Всеки студент може да бъде поставен и на отделен ред.
- Датата да е във формат YYYY-MM-DD.
- Часовете да са във формат HH:MM.
- Часовете трябва да бъдат между 08:00 и 18:00.
- Ако липсва план за деня, напиши "-".
- Ако липсва факултетен номер, напиши "-".
- Ако липсва университет, напиши "-".
- Не добавяй номерация, markdown таблица или допълнителен текст.

Пример:
2026-07-27,Консултации,Иван,Иванов,328СР,УНИБИТ,11:00,12:30;
2026-07-27,Консултации,Георги,Петров,329СР,СУ,13:00,14:00;
2026-07-28,Защити,Сияна,Георгиева,330СР,ТУ София,09:00,10:30`;

const monthNames = [
    "Януари",
    "Февруари",
    "Март",
    "Април",
    "Май",
    "Юни",
    "Юли",
    "Август",
    "Септември",
    "Октомври",
    "Ноември",
    "Декември"
];

let schedule = {};
let selectedDate = null;
let editingId = null;

const today =
    startOfLocalDay(
        new Date()
    );

let currentMonth =
    today.getMonth();

let currentYear =
    today.getFullYear();

const calendarBox =
    document.getElementById(
        "calendarBox"
    );

const detailsBox =
    document.getElementById(
        "detailsBox"
    );

const detailsInnerScroll =
    document.getElementById(
        "detailsInnerScroll"
    );

const calendarDays =
    document.getElementById(
        "calendarDays"
    );

const monthTitle =
    document.getElementById(
        "monthTitle"
    );

const prevMonthBtn =
    document.getElementById(
        "prevMonthBtn"
    );

const nextMonthBtn =
    document.getElementById(
        "nextMonthBtn"
    );

const selectedDateText =
    document.getElementById(
        "selectedDateText"
    );

const sidePreview =
    document.getElementById(
        "sidePreview"
    );

const studentForm =
    document.getElementById(
        "studentForm"
    );

const formTitle =
    document.getElementById(
        "formTitle"
    );

const dayNameInput =
    document.getElementById(
        "dayName"
    );

const startTimeInput =
    document.getElementById(
        "startTime"
    );

const endTimeInput =
    document.getElementById(
        "endTime"
    );

const firstNameInput =
    document.getElementById(
        "firstName"
    );

const lastNameInput =
    document.getElementById(
        "lastName"
    );

const facultyNumberInput =
    document.getElementById(
        "facultyNumber"
    );

const universityInput =
    document.getElementById(
        "university"
    );

const saveBtn =
    document.getElementById(
        "saveBtn"
    );

const cancelEditBtn =
    document.getElementById(
        "cancelEditBtn"
    );

const formMessage =
    document.getElementById(
        "formMessage"
    );

const bulkStudentsInput =
    document.getElementById(
        "bulkStudentsInput"
    );

const bulkEditor =
    document.getElementById(
        "bulkEditor"
    );

const bulkHighlightLayer =
    document.getElementById(
        "bulkHighlightLayer"
    );

const addStudentsListBtn =
    document.getElementById(
        "addStudentsListBtn"
    );

const clearStudentsListBtn =
    document.getElementById(
        "clearStudentsListBtn"
    );

const bulkMessage =
    document.getElementById(
        "bulkMessage"
    );

const bulkResult =
    document.getElementById(
        "bulkResult"
    );

const bulkAddedCount =
    document.getElementById(
        "bulkAddedCount"
    );

const bulkSkippedCount =
    document.getElementById(
        "bulkSkippedCount"
    );

const bulkErrorCount =
    document.getElementById(
        "bulkErrorCount"
    );

const bulkErrorList =
    document.getElementById(
        "bulkErrorList"
    );

const copyPromptBtn =
    document.getElementById(
        "copyPromptBtn"
    );

const copyPromptStatus =
    document.getElementById(
        "copyPromptStatus"
    );

function startOfLocalDay(date) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}

function formatDate(
    year,
    month,
    day
) {
    return [
        String(year).padStart(
            4,
            "0"
        ),

        String(month + 1).padStart(
            2,
            "0"
        ),

        String(day).padStart(
            2,
            "0"
        )
    ].join("-");
}

function parseDateKey(dateKey) {
    const match =
        /^(\d{4})-(\d{2})-(\d{2})$/.exec(
            String(dateKey)
                .trim()
        );

    if (!match) {
        return null;
    }

    const year =
        Number(match[1]);

    const month =
        Number(match[2]) - 1;

    const day =
        Number(match[3]);

    const date =
        new Date(
            year,
            month,
            day
        );

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

function getTodayKey() {
    return formatDate(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );
}

function isPastDate(date) {
    return (
        startOfLocalDay(
            date
        ).getTime() <
        today.getTime()
    );
}

function isWeekend(date) {
    return (
        date.getDay() === 0 ||
        date.getDay() === 6
    );
}

function getBulgarianDayIndex(date) {
    return (
        date.getDay() === 0
            ? 6
            : date.getDay() - 1
    );
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

function createId() {
    if (
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID ===
            "function"
    ) {
        return globalThis.crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );
}

function getStudentColor(index) {
    return STUDENT_COLORS[
        index %
        STUDENT_COLORS.length
    ];
}

function normalizeEmptyValue(value) {
    const normalized =
        String(value || "")
            .trim();

    return normalized === "-"
        ? ""
        : normalized;
}

function normalizeStoredTime(
    value,
    fallback
) {
    const match =
        /^(\d{1,2})(?::(\d{2}))?$/.exec(
            String(value || "")
                .trim()
        );

    if (!match) {
        return fallback;
    }

    const hour =
        Number(match[1]);

    const minute =
        Number(
            match[2] || "00"
        );

    if (
        hour < OPENING_HOUR ||
        hour > CLOSING_HOUR
    ) {
        return fallback;
    }

    if (
        minute !== 0 &&
        minute !== 30
    ) {
        return fallback;
    }

    if (
        hour === CLOSING_HOUR &&
        minute !== 0
    ) {
        return fallback;
    }

    return (
        String(hour).padStart(
            2,
            "0"
        ) +
        ":" +
        String(minute).padStart(
            2,
            "0"
        )
    );
}

function isAllowedTime(value) {
    const match =
        /^(\d{2}):(\d{2})$/.exec(
            String(value)
                .trim()
        );

    if (!match) {
        return false;
    }

    const hour =
        Number(match[1]);

    const minute =
        Number(match[2]);

    if (
        !Number.isInteger(hour) ||
        !Number.isInteger(minute)
    ) {
        return false;
    }

    if (
        minute < 0 ||
        minute > 59
    ) {
        return false;
    }

    const totalMinutes =
        hour * 60 + minute;

    const openingMinutes =
        OPENING_HOUR * 60;

    const closingMinutes =
        CLOSING_HOUR * 60;

    return (
        totalMinutes >= openingMinutes &&
        totalMinutes <= closingMinutes
    );
}

function normalizeBooking(
    rawBooking,
    fallbackId
) {
    const booking =
        rawBooking &&
        typeof rawBooking === "object"
            ? rawBooking
            : {};

    return {
        id:
            String(
                booking.id ||
                fallbackId ||
                createId()
            ),

        startTime:
            normalizeStoredTime(
                booking.startTime,
                "08:00"
            ),

        endTime:
            normalizeStoredTime(
                booking.endTime,
                "09:00"
            ),

        firstName:
            String(
                booking.firstName ||
                ""
            ).trim(),

        lastName:
            String(
                booking.lastName ||
                ""
            ).trim(),

        facultyNumber:
            normalizeEmptyValue(
                booking.facultyNumber
            ),

        university:
            normalizeEmptyValue(
                booking.university
            )
    };
}

function migrateSchedule(rawData) {
    const result = {};

    if (
        !rawData ||
        typeof rawData !== "object" ||
        Array.isArray(rawData)
    ) {
        return result;
    }

    Object.entries(
        rawData
    ).forEach(
        function (
            [dateKey, value]
        ) {
            if (
                !parseDateKey(dateKey) ||
                !value ||
                typeof value !== "object"
            ) {
                return;
            }

            if (
                Array.isArray(
                    value.bookings
                )
            ) {
                result[dateKey] = {
                    dayName:
                        normalizeEmptyValue(
                            value.dayName
                        ),

                    bookings:
                        value.bookings
                            .map(
                                function (
                                    booking,
                                    index
                                ) {
                                    return normalizeBooking(
                                        booking,
                                        dateKey +
                                        "-" +
                                        index
                                    );
                                }
                            )
                            .slice(
                                0,
                                MAX_STUDENTS_PER_DAY
                            )
                };

                return;
            }

            const oldBookings =
                Object.entries(
                    value
                ).map(
                    function (
                        [slot, student],
                        index
                    ) {
                        const [
                            startTime,
                            endTime
                        ] =
                            slot.split(
                                " - "
                            );

                        return normalizeBooking({
                            id:
                                dateKey +
                                "-legacy-" +
                                index,

                            startTime,

                            endTime,

                            firstName:
                                student
                                    ?.firstName,

                            lastName:
                                student
                                    ?.lastName,

                            facultyNumber:
                                student
                                    ?.facultyNumber,

                            university:
                                student
                                    ?.university
                        });
                    }
                );

            result[dateKey] = {
                dayName: "",

                bookings:
                    oldBookings.slice(
                        0,
                        MAX_STUDENTS_PER_DAY
                    )
            };
        }
    );

    return result;
}

function readStorageValue(key) {
    try {
        const raw =
            localStorage.getItem(
                key
            );

        return raw
            ? JSON.parse(raw)
            : null;
    } catch (error) {
        console.error(
            "Грешка при четене от localStorage:",
            error
        );

        return null;
    }
}

function loadScheduleFromStorage() {
    const currentData =
        readStorageValue(
            STORAGE_KEY
        );

    if (currentData) {
        return migrateSchedule(
            currentData
        );
    }

    return migrateSchedule(
        readStorageValue(
            LEGACY_STORAGE_KEY
        )
    );
}

function saveScheduleToStorage() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
                schedule
            )
        );

        localStorage.removeItem(
            LEGACY_STORAGE_KEY
        );

        return true;
    } catch (error) {
        console.error(
            "Грешка при запис в localStorage:",
            error
        );

        showMessage(
            "Браузърът не позволи запис в localStorage.",
            "error"
        );

        return false;
    }
}

function cleanupPastSchedule() {
    const todayKey =
        getTodayKey();

    let changed = false;

    Object.keys(
        schedule
    ).forEach(
        function (dateKey) {
            if (
                !parseDateKey(dateKey) ||
                dateKey < todayKey
            ) {
                delete schedule[
                    dateKey
                ];

                changed = true;
            }
        }
    );

    if (changed) {
        saveScheduleToStorage();
    }
}

function getExistingDayData(dateKey) {
    const data =
        schedule[dateKey];

    if (
        !data ||
        typeof data !== "object"
    ) {
        return {
            dayName: "",
            bookings: []
        };
    }

    return {
        dayName:
            String(
                data.dayName ||
                ""
            ),

        bookings:
            Array.isArray(
                data.bookings
            )
                ? data.bookings
                : []
    };
}

function getDayData(dateKey) {
    if (!schedule[dateKey]) {
        schedule[dateKey] = {
            dayName: "",
            bookings: []
        };
    }

    if (
        !Array.isArray(
            schedule[
                dateKey
            ].bookings
        )
    ) {
        schedule[
            dateKey
        ].bookings = [];
    }

    return schedule[dateKey];
}

function getBookedCount(dateKey) {
    return getExistingDayData(
        dateKey
    ).bookings.length;
}

function getDayClass(
    dateKey,
    dateObject
) {
    if (
        isWeekend(dateObject) ||
        isPastDate(dateObject)
    ) {
        return "unavailable-day";
    }

    const count =
        getBookedCount(
            dateKey
        );

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

function timeToMinutes(time) {
    const [
        hour,
        minute
    ] =
        String(time)
            .split(":")
            .map(Number);

    return (
        hour * 60 +
        minute
    );
}

function sortBookings(bookings) {
    return bookings
        .slice()
        .sort(
            function (a, b) {
                const startDifference =
                    timeToMinutes(
                        a.startTime
                    ) -
                    timeToMinutes(
                        b.startTime
                    );

                if (
                    startDifference !== 0
                ) {
                    return startDifference;
                }

                return (
                    timeToMinutes(
                        a.endTime
                    ) -
                    timeToMinutes(
                        b.endTime
                    )
                );
            }
        );
}

function findBooking(
    dateKey,
    id
) {
    return getExistingDayData(
        dateKey
    ).bookings.find(
        function (booking) {
            return booking.id === id;
        }
    );
}

function populateTimeOptions() {
    const times = [];

    for (
        let hour =
            OPENING_HOUR;
        hour <=
            CLOSING_HOUR;
        hour++
    ) {
        times.push(
            String(hour).padStart(
                2,
                "0"
            ) +
            ":00"
        );

        if (
            hour <
            CLOSING_HOUR
        ) {
            times.push(
                String(hour).padStart(
                    2,
                    "0"
                ) +
                ":30"
            );
        }
    }

    [
        startTimeInput,
        endTimeInput
    ].forEach(
        function (select) {
            select.replaceChildren();

            const emptyOption =
                document.createElement(
                    "option"
                );

            emptyOption.value = "";

            emptyOption.textContent =
                "Избери час";

            select.appendChild(
                emptyOption
            );

            times.forEach(
                function (time) {
                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        time;

                    option.textContent =
                        time;

                    select.appendChild(
                        option
                    );
                }
            );
        }
    );
}

function isCurrentMonthView() {
    return (
        currentYear ===
            today.getFullYear() &&
        currentMonth ===
            today.getMonth()
    );
}

function syncDetailsHeight() {
    if (
        window.innerWidth <= 1250
    ) {
        detailsBox.style.height =
            "";

        return;
    }

    const calendarHeight =
        Math.ceil(
            calendarBox
                .getBoundingClientRect()
                .height
        );

    detailsBox.style.height =
        calendarHeight +
        "px";
}

function renderCalendar() {
    calendarDays.replaceChildren();

    monthTitle.textContent =
        monthNames[
            currentMonth
        ] +
        " " +
        currentYear;

    prevMonthBtn.disabled =
        isCurrentMonthView();

    const firstDay =
        new Date(
            currentYear,
            currentMonth,
            1
        );

    const lastDay =
        new Date(
            currentYear,
            currentMonth + 1,
            0
        );

    const emptyCells =
        getBulgarianDayIndex(
            firstDay
        );

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

        empty.setAttribute(
            "aria-hidden",
            "true"
        );

        calendarDays.appendChild(
            empty
        );
    }

    for (
        let day = 1;
        day <=
            lastDay.getDate();
        day++
    ) {
        const dateObject =
            new Date(
                currentYear,
                currentMonth,
                day
            );

        const dateKey =
            formatDate(
                currentYear,
                currentMonth,
                day
            );

        const dayData =
            getExistingDayData(
                dateKey
            );

        const bookedCount =
            getBookedCount(
                dateKey
            );

        const unavailable =
            isWeekend(dateObject) ||
            isPastDate(dateObject);

        const dayElement =
            document.createElement(
                unavailable
                    ? "div"
                    : "button"
            );

        dayElement.className =
            "day " +
            getDayClass(
                dateKey,
                dateObject
            );

        dayElement.dataset.date =
            dateKey;

        if (!unavailable) {
            dayElement.type =
                "button";

            dayElement.setAttribute(
                "aria-label",
                dateKey +
                ", " +
                bookedCount +
                " записани"
            );
        }

        if (
            selectedDate ===
            dateKey
        ) {
            dayElement.classList.add(
                "selected"
            );
        }

        if (
            dateKey ===
            getTodayKey()
        ) {
            dayElement.classList.add(
                "today"
            );
        }

        const dayNameHtml =
            dayData.dayName
                ? `
                    <small
                        class="day-name-label"
                        title="${escapeHtml(
                            dayData.dayName
                        )}"
                    >
                        ${escapeHtml(
                            dayData.dayName
                        )}
                    </small>
                `
                : "";

        let statusText =
            bookedCount +
            "/" +
            MAX_STUDENTS_PER_DAY +
            " човека";

        if (
            isPastDate(
                dateObject
            )
        ) {
            statusText =
                "минал ден";
        } else if (
            isWeekend(
                dateObject
            )
        ) {
            statusText =
                "почивен ден";
        }

        dayElement.innerHTML = `
            <div class="day-number">
                ${day}
            </div>

            ${dayNameHtml}

            <small>
                ${statusText}
            </small>
        `;

        if (!unavailable) {
            dayElement.addEventListener(
                "click",
                function () {
                    selectDate(
                        dateKey
                    );
                }
            );
        }

        calendarDays.appendChild(
            dayElement
        );
    }

    requestAnimationFrame(
        syncDetailsHeight
    );
}

function createTooltipHtml(
    booking
) {
    const fullName =
        (
            booking.firstName +
            " " +
            booking.lastName
        ).trim() ||
        "-";

    return `
        <span
            class="student-tooltip"
            role="tooltip"
        >
            <strong class="tooltip-name">
                ${escapeHtml(
                    fullName
                )}
            </strong>

            <span class="tooltip-row">
                <span class="tooltip-label">
                    Час:
                </span>

                <span class="tooltip-value">
                    ${escapeHtml(
                        booking.startTime
                    )}
                    –
                    ${escapeHtml(
                        booking.endTime
                    )}
                </span>
            </span>

            <span class="tooltip-row">
                <span class="tooltip-label">
                    Фак. номер:
                </span>

                <span class="tooltip-value">
                    ${escapeHtml(
                        booking.facultyNumber ||
                        "-"
                    )}
                </span>
            </span>

            <span class="tooltip-row">
                <span class="tooltip-label">
                    Университет:
                </span>

                <span class="tooltip-value">
                    ${escapeHtml(
                        booking.university ||
                        "-"
                    )}
                </span>
            </span>
        </span>
    `;
}

function buildTimelineGraph(
    bookings
) {
    const totalMinutes =
        (
            CLOSING_HOUR -
            OPENING_HOUR
        ) *
        60;

    const hourHeight =
        TIMELINE_HEIGHT /
        (
            CLOSING_HOUR -
            OPENING_HOUR
        );

    const hourLabels = [];

    for (
        let hour =
            OPENING_HOUR;
        hour <=
            CLOSING_HOUR;
        hour++
    ) {
        const top =
            TIMELINE_HEADER_HEIGHT +
            (
                hour -
                OPENING_HOUR
            ) *
            hourHeight;

        hourLabels.push(`
            <div
                class="time-cell"
                style="top: ${top}px"
            >
                ${String(
                    hour
                ).padStart(
                    2,
                    "0"
                )}:00
            </div>
        `);
    }

    const columns =
        bookings
            .map(
                function (
                    booking,
                    index
                ) {
                    const openingMinutes =
                        OPENING_HOUR *
                        60;

                    const closingMinutes =
                        CLOSING_HOUR *
                        60;

                    const start =
                        Math.max(
                            timeToMinutes(
                                booking.startTime
                            ),
                            openingMinutes
                        );

                    const end =
                        Math.min(
                            timeToMinutes(
                                booking.endTime
                            ),
                            closingMinutes
                        );

                    const safeEnd =
                        Math.max(
                            end,
                            start + 30
                        );

                    const top =
                        (
                            (
                                start -
                                openingMinutes
                            ) /
                            totalMinutes
                        ) *
                        TIMELINE_HEIGHT;

                    const height =
                        Math.max(
                            (
                                (
                                    safeEnd -
                                    start
                                ) /
                                totalMinutes
                            ) *
                            TIMELINE_HEIGHT,
                            22
                        );

                    const fullName =
                        (
                            booking.firstName +
                            " " +
                            booking.lastName
                        ).trim();

                    const color =
                        getStudentColor(
                            index
                        );

                    return `
                        <div class="person-column">
                            <div
                                class="person-name"
                                title="${escapeHtml(
                                    fullName
                                )}"
                            >
                                ${escapeHtml(
                                    booking.firstName ||
                                    "№" +
                                    (
                                        index + 1
                                    )
                                )}
                            </div>

                            <div class="column-body">
                                <button
                                    type="button"
                                    class="busy-block"
                                    style="
                                        top: ${top}px;
                                        height: ${height}px;
                                        --booking-color: ${color};
                                    "
                                >
                                    <span class="busy-time-text">
                                        ${escapeHtml(
                                            booking.startTime
                                        )}
                                        –
                                        ${escapeHtml(
                                            booking.endTime
                                        )}
                                    </span>

                                    ${createTooltipHtml(
                                        booking
                                    )}
                                </button>
                            </div>
                        </div>
                    `;
                }
            )
            .join("");

    return `
        <section class="timeline-section">
            <div class="timeline-section-title">
                <h4>
                    Дневен график
                </h4>

                <span>
                    08:00 – 18:00
                </span>
            </div>

            <div class="timeline">
                <div class="timeline-wrapper">
                    <div
                        class="time-scale"
                        style="
                            height: ${
                                TIMELINE_HEIGHT +
                                TIMELINE_HEADER_HEIGHT
                            }px;
                        "
                    >
                        ${hourLabels.join("")}
                    </div>

                    <div
                        class="people-grid"
                        style="
                            --student-count: ${Math.max(
                                bookings.length,
                                1
                            )};
                        "
                    >
                        ${columns}
                    </div>
                </div>
            </div>
        </section>
    `;
}

function buildBookingsList(
    bookings
) {
    const cards =
        bookings
            .map(
                function (booking) {
                    return `
                        <article class="preview-booking-card">
                            <strong>
                                ${escapeHtml(
                                    booking.startTime
                                )}
                                –
                                ${escapeHtml(
                                    booking.endTime
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    booking.firstName
                                )}
                                ${escapeHtml(
                                    booking.lastName
                                )}
                            </span>

                            <small>
                                ${escapeHtml(
                                    booking.facultyNumber ||
                                    "-"
                                )}
                                |
                                ${escapeHtml(
                                    booking.university ||
                                    "-"
                                )}
                            </small>

                            <div class="slot-actions">
                                <button
                                    type="button"
                                    class="edit-booking-btn"
                                    data-id="${escapeHtml(
                                        booking.id
                                    )}"
                                >
                                    Редактирай
                                </button>

                                <button
                                    type="button"
                                    class="delete-booking-btn"
                                    data-id="${escapeHtml(
                                        booking.id
                                    )}"
                                >
                                    Премахни
                                </button>
                            </div>
                        </article>
                    `;
                }
            )
            .join("");

    return `
        <section class="bookings-section">
            <div class="bookings-section-header">
                <h4>
                    Записани студенти
                </h4>

                <span>
                    ${bookings.length}
                    /
                    ${MAX_STUDENTS_PER_DAY}
                </span>
            </div>

            <div class="booking-list">
                ${cards}
            </div>
        </section>
    `;
}

function renderSidePreview(
    dateKey
) {
    const dateObject =
        parseDateKey(
            dateKey
        );

    if (!dateObject) {
        sidePreview.innerHTML = `
            <p class="empty-text">
                Невалидна дата.
            </p>
        `;

        return;
    }

    const dayData =
        getExistingDayData(
            dateKey
        );

    const bookings =
        sortBookings(
            dayData.bookings
        );

    const title =
        dayData.dayName
            ? " — " +
            escapeHtml(
                dayData.dayName
            )
            : "";

    if (
        bookings.length === 0
    ) {
        sidePreview.innerHTML = `
            <h3>
                ${escapeHtml(
                    dateKey
                )}
                ${title}
            </h3>

            <p class="empty-text">
                Няма записани хора.
            </p>
        `;

        return;
    }

    sidePreview.innerHTML = `
        <h3>
            ${escapeHtml(
                dateKey
            )}
            ${title}
        </h3>

        <p>
            <strong>
                Записани:
            </strong>

            ${bookings.length}
            /
            ${MAX_STUDENTS_PER_DAY}
        </p>

        ${buildTimelineGraph(
            bookings
        )}

        ${buildBookingsList(
            bookings
        )}
    `;
}

function setFormDisabled(
    disabled
) {
    [
        dayNameInput,
        startTimeInput,
        endTimeInput,
        firstNameInput,
        lastNameInput,
        facultyNumberInput,
        universityInput,
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

function updateFormMode() {
    const editing =
        editingId !== null;

    formTitle.textContent =
        editing
            ? "Редактиране на запис"
            : "Добавяне на студент";

    saveBtn.textContent =
        editing
            ? "Запази промените"
            : "Потвърди";

    cancelEditBtn.hidden =
        !editing;
}

function clearStudentFields() {
    startTimeInput.value = "";
    endTimeInput.value = "";
    firstNameInput.value = "";
    lastNameInput.value = "";
    facultyNumberInput.value = "";
    universityInput.value = "";
}

function showMessage(
    text,
    type = ""
) {
    formMessage.textContent =
        text;

    formMessage.className =
        "form-message" +
        (
            type
                ? " " + type
                : ""
        );
}

function showBulkMessage(
    text,
    type = ""
) {
    bulkMessage.textContent =
        text;

    bulkMessage.className =
        "bulk-message" +
        (
            type
                ? " " + type
                : ""
        );
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
        String(
            result.added
        );

    bulkSkippedCount.textContent =
        String(
            result.skipped
        );

    bulkErrorCount.textContent =
        String(
            result.errors.length
        );

    bulkErrorList.replaceChildren();

    result.errors
        .slice(0, 100)
        .forEach(
            function (errorText) {
                const listItem =
                    document.createElement(
                        "li"
                    );

                listItem.textContent =
                    errorText;

                bulkErrorList.appendChild(
                    listItem
                );
            }
        );

    if (
        result.errors.length > 100
    ) {
        const listItem =
            document.createElement(
                "li"
            );

        listItem.textContent =
            "Показани са първите 100 грешки.";

        bulkErrorList.appendChild(
            listItem
        );
    }

    bulkErrorList.hidden =
        result.errors.length === 0;

    bulkResult.hidden =
        false;
}

function resetSelectedDateState() {
    selectedDate = null;
    editingId = null;

    selectedDateText.textContent =
        "Изберете работен ден от календара.";

    sidePreview.innerHTML = `
        <p class="empty-text">
            Изберете ден, за да видите дневния график
            и записаните студенти.
        </p>
    `;

    dayNameInput.value = "";

    clearStudentFields();
    showMessage("");
    updateFormMode();
    setFormDisabled(true);

    detailsInnerScroll.scrollTop =
        0;
}

function selectDate(dateKey) {
    const date =
        parseDateKey(
            dateKey
        );

    if (
        !date ||
        isPastDate(date) ||
        isWeekend(date)
    ) {
        return;
    }

    selectedDate =
        dateKey;

    editingId = null;

    const dayData =
        getDayData(
            dateKey
        );

    selectedDateText.textContent =
        "Избрана дата: " +
        dateKey;

    dayNameInput.value =
        dayData.dayName ||
        "";

    clearStudentFields();
    showMessage("");
    updateFormMode();
    setFormDisabled(false);

    renderSidePreview(
        dateKey
    );

    renderCalendar();

    detailsInnerScroll.scrollTop =
        0;
}

function validateForm(dayData) {
    if (!selectedDate) {
        return "Изберете дата.";
    }

    if (
        !startTimeInput.value ||
        !endTimeInput.value
    ) {
        return "Попълнете начален и краен час.";
    }

    if (
        timeToMinutes(
            startTimeInput.value
        ) >=
        timeToMinutes(
            endTimeInput.value
        )
    ) {
        return "Крайният час трябва да бъде след началния.";
    }

    if (
        !firstNameInput.value.trim() ||
        !lastNameInput.value.trim()
    ) {
        return "Попълнете име и фамилия.";
    }

    if (
        editingId === null &&
        dayData.bookings.length >=
            MAX_STUDENTS_PER_DAY
    ) {
        return "За един ден могат да бъдат записани най-много 10 човека.";
    }

    return "";
}

function getBookingSignature(
    dateKey,
    booking
) {
    return [
        dateKey,

        String(
            booking.firstName ||
            ""
        )
            .trim()
            .toLocaleLowerCase(),

        String(
            booking.lastName ||
            ""
        )
            .trim()
            .toLocaleLowerCase(),

        String(
            booking.facultyNumber ||
            ""
        )
            .trim()
            .toLocaleLowerCase(),

        booking.startTime,

        booking.endTime
    ].join("|");
}

function isHeaderRecord(columns) {
    const joined =
        columns
            .join(",")
            .toLocaleLowerCase();

    return (
        joined.includes(
            "факултетен номер"
        ) &&
        joined.includes(
            "университет"
        )
    );
}

function splitBulkRecords(text) {
    const source =
        String(text)
            .replaceAll(
                "\r\n",
                "\n"
            )
            .replaceAll(
                "\r",
                "\n"
            );

    const records = [];
    const separatorPattern =
        /[;\n]+/g;

    let recordStart = 0;
    let match;

    while (
        (match = separatorPattern.exec(source)) !== null
    ) {
        const rawRecord =
            source.slice(
                recordStart,
                match.index
            );

        const trimmedRecord =
            rawRecord.trim();

        if (trimmedRecord) {
            const leadingWhitespace =
                rawRecord.length -
                rawRecord.trimStart().length;

            const trailingWhitespace =
                rawRecord.length -
                rawRecord.trimEnd().length;

            records.push({
                text: trimmedRecord,
                start: recordStart + leadingWhitespace,
                end: match.index - trailingWhitespace
            });
        }

        recordStart =
            match.index + match[0].length;
    }

    const finalRawRecord =
        source.slice(recordStart);

    const finalTrimmedRecord =
        finalRawRecord.trim();

    if (finalTrimmedRecord) {
        const leadingWhitespace =
            finalRawRecord.length -
            finalRawRecord.trimStart().length;

        const trailingWhitespace =
            finalRawRecord.length -
            finalRawRecord.trimEnd().length;

        records.push({
            text: finalTrimmedRecord,
            start: recordStart + leadingWhitespace,
            end: source.length - trailingWhitespace
        });
    }

    return {
        source,
        records
    };
}

function escapeHighlightHtml(value) {
    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        );
}

function clearBulkHighlights() {
    bulkEditor.classList.remove(
        "has-results"
    );

    bulkHighlightLayer.textContent =
        "";

    bulkHighlightLayer.scrollTop = 0;
    bulkHighlightLayer.scrollLeft = 0;
}

function renderBulkHighlights(
    source,
    records,
    recordStates
) {
    let cursor = 0;
    const htmlParts = [];

    records.forEach(
        function (record, index) {
            htmlParts.push(
                escapeHighlightHtml(
                    source.slice(
                        cursor,
                        record.start
                    )
                )
            );

            const state =
                recordStates.get(index + 1) ||
                "error";

            htmlParts.push(
                '<mark class="bulk-record-highlight ' +
                state +
                '">'
            );

            htmlParts.push(
                escapeHighlightHtml(
                    source.slice(
                        record.start,
                        record.end
                    )
                )
            );

            htmlParts.push("</mark>");
            cursor = record.end;
        }
    );

    htmlParts.push(
        escapeHighlightHtml(
            source.slice(cursor)
        )
    );

    bulkHighlightLayer.innerHTML =
        htmlParts.join("");

    bulkEditor.classList.add(
        "has-results"
    );

    bulkHighlightLayer.scrollTop =
        bulkStudentsInput.scrollTop;

    bulkHighlightLayer.scrollLeft =
        bulkStudentsInput.scrollLeft;
}

function parseBulkRecord(
    record,
    recordNumber
) {
    const columns =
        record
            .split(",")
            .map(
                function (value) {
                    return value.trim();
                }
            );

    if (
        isHeaderRecord(
            columns
        )
    ) {
        return {
            type: "header"
        };
    }

    let dateKey = "";
    let dayName = "";
    let firstName = "";
    let lastName = "";
    let facultyNumber = "";
    let university = "";
    let startTime = "";
    let endTime = "";

    if (
        columns.length === 6
    ) {
        if (!selectedDate) {
            return {
                type: "error",

                message:
                    "Запис " +
                    recordNumber +
                    ": форматът с 6 атрибута изисква избрана дата."
            };
        }

        dateKey =
            selectedDate;

        [
            firstName,
            lastName,
            facultyNumber,
            university,
            startTime,
            endTime
        ] = columns;
    } else if (
        columns.length === 7
    ) {
        [
            dateKey,
            firstName,
            lastName,
            facultyNumber,
            university,
            startTime,
            endTime
        ] = columns;
    } else if (
        columns.length === 8
    ) {
        [
            dateKey,
            dayName,
            firstName,
            lastName,
            facultyNumber,
            university,
            startTime,
            endTime
        ] = columns;
    } else {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": очакват се 6, 7 или 8 атрибута, разделени със запетая."
        };
    }

    const date =
        parseDateKey(
            dateKey
        );

    if (!date) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": невалидна дата."
        };
    }

    if (
        isPastDate(date)
    ) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": датата е в миналото."
        };
    }

    if (
        isWeekend(date)
    ) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": датата е почивен ден."
        };
    }

    if (
        !firstName ||
        !lastName
    ) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": липсва име или фамилия."
        };
    }

    if (
        !isAllowedTime(
            startTime
        ) ||
        !isAllowedTime(
            endTime
        )
    ) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": часовете трябва да са между 08:00 и 18:00."
        };
    }

    if (
        timeToMinutes(
            startTime
        ) >=
        timeToMinutes(
            endTime
        )
    ) {
        return {
            type: "error",

            message:
                "Запис " +
                recordNumber +
                ": крайният час трябва да бъде след началния."
        };
    }

    return {
        type: "student",

        recordNumber,

        dateKey,

        dayName:
            normalizeEmptyValue(
                dayName
            ),

        booking: {
            id: createId(),

            firstName:
                firstName.trim(),

            lastName:
                lastName.trim(),

            facultyNumber:
                normalizeEmptyValue(
                    facultyNumber
                ),

            university:
                normalizeEmptyValue(
                    university
                ),

            startTime:
                startTime.trim(),

            endTime:
                endTime.trim()
        }
    };
}

function addStudentsFromList() {
    const rawText =
        bulkStudentsInput.value;

    const text =
        rawText.trim();

    showBulkMessage("");
    clearBulkResult();
    clearBulkHighlights();

    if (!text) {
        showBulkMessage(
            "Поставете списък със студенти.",
            "error"
        );

        return;
    }

    const splitResult =
        splitBulkRecords(rawText);

    const records =
        splitResult.records;

    if (records.length === 0) {
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

    const recordStates = new Map();
    const parsedStudents = [];

    records.forEach(
        function (record, index) {
            const recordNumber = index + 1;
            const parsed =
                parseBulkRecord(
                    record.text,
                    recordNumber
                );

            if (parsed.type === "header") {
                result.skipped++;
                recordStates.set(
                    recordNumber,
                    "skipped"
                );

                return;
            }

            if (parsed.type === "error") {
                result.errors.push(parsed.message);
                recordStates.set(
                    recordNumber,
                    "error"
                );

                return;
            }

            parsedStudents.push(parsed);
        }
    );

    const knownSignatures = new Set();

    Object.entries(schedule).forEach(
        function ([dateKey, dayData]) {
            const bookings =
                Array.isArray(dayData.bookings)
                    ? dayData.bookings
                    : [];

            bookings.forEach(
                function (booking) {
                    knownSignatures.add(
                        getBookingSignature(
                            dateKey,
                            booking
                        )
                    );
                }
            );
        }
    );

    const additionsByDate = new Map();

    parsedStudents.forEach(
        function (parsed) {
            const signature =
                getBookingSignature(
                    parsed.dateKey,
                    parsed.booking
                );

            if (knownSignatures.has(signature)) {
                result.skipped++;
                result.errors.push(
                    "Запис " +
                    parsed.recordNumber +
                    ": дублиран студент или часови диапазон."
                );

                recordStates.set(
                    parsed.recordNumber,
                    "error"
                );

                return;
            }

            if (!additionsByDate.has(parsed.dateKey)) {
                additionsByDate.set(parsed.dateKey, []);
            }

            additionsByDate
                .get(parsed.dateKey)
                .push(parsed);

            knownSignatures.add(signature);
        }
    );

    additionsByDate.forEach(
        function (additions, dateKey) {
            const dayData = getDayData(dateKey);
            let availablePlaces =
                MAX_STUDENTS_PER_DAY -
                dayData.bookings.length;

            additions.forEach(
                function (parsed) {
                    if (availablePlaces <= 0) {
                        result.skipped++;
                        result.errors.push(
                            "Запис " +
                            parsed.recordNumber +
                            ": няма свободно място за " +
                            dateKey +
                            "."
                        );

                        recordStates.set(
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

                    availablePlaces--;
                    result.added++;
                    recordStates.set(
                        parsed.recordNumber,
                        "success"
                    );
                }
            );
        }
    );

    if (result.added > 0) {
        saveScheduleToStorage();
        renderCalendar();

        if (selectedDate) {
            renderSidePreview(selectedDate);
        }

        showBulkMessage(
            "Добавени са " +
            result.added +
            " студенти. Успешните записи са маркирани в зелено.",
            "success"
        );
    } else {
        showBulkMessage(
            "Не бяха добавени нови студенти. Провери записите, маркирани в червено.",
            "error"
        );
    }

    parsedStudents.forEach(
        function (parsed) {
            if (!recordStates.has(parsed.recordNumber)) {
                recordStates.set(
                    parsed.recordNumber,
                    "error"
                );
            }
        }
    );

    renderBulkHighlights(
        splitResult.source,
        records,
        recordStates
    );

    showBulkResult(result);
}

studentForm.addEventListener(
    "submit",
    function (event) {
        event.preventDefault();

        if (!selectedDate) {
            showMessage(
                "Изберете дата.",
                "error"
            );

            return;
        }

        const dayData =
            getDayData(
                selectedDate
            );

        const error =
            validateForm(
                dayData
            );

        if (error) {
            showMessage(
                error,
                "error"
            );

            return;
        }

        dayData.dayName =
            dayNameInput.value.trim();

        const bookingData = {
            startTime:
                startTimeInput.value,

            endTime:
                endTimeInput.value,

            firstName:
                firstNameInput.value.trim(),

            lastName:
                lastNameInput.value.trim(),

            facultyNumber:
                facultyNumberInput.value.trim(),

            university:
                universityInput.value.trim()
        };

        if (
            editingId !== null
        ) {
            const booking =
                findBooking(
                    selectedDate,
                    editingId
                );

            if (!booking) {
                showMessage(
                    "Записът не съществува.",
                    "error"
                );

                return;
            }

            Object.assign(
                booking,
                bookingData
            );

            editingId = null;

            showMessage(
                "Записът е редактиран.",
                "success"
            );
        } else {
            const signature =
                getBookingSignature(
                    selectedDate,
                    bookingData
                );

            const duplicate =
                dayData.bookings.some(
                    function (booking) {
                        return (
                            getBookingSignature(
                                selectedDate,
                                booking
                            ) ===
                            signature
                        );
                    }
                );

            if (duplicate) {
                showMessage(
                    "Този студент и часови диапазон вече съществуват.",
                    "error"
                );

                return;
            }

            dayData.bookings.push({
                id: createId(),
                ...bookingData
            });

            showMessage(
                "Студентът е добавен.",
                "success"
            );
        }

        saveScheduleToStorage();

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

    startTimeInput.value =
        booking.startTime;

    endTimeInput.value =
        booking.endTime;

    firstNameInput.value =
        booking.firstName;

    lastNameInput.value =
        booking.lastName;

    facultyNumberInput.value =
        booking.facultyNumber;

    universityInput.value =
        booking.university;

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
        getDayData(
            selectedDate
        );

    const booking =
        dayData.bookings.find(
            function (item) {
                return item.id === id;
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

    dayData.bookings =
        dayData.bookings.filter(
            function (item) {
                return item.id !== id;
            }
        );

    if (
        editingId === id
    ) {
        editingId = null;

        clearStudentFields();
        updateFormMode();
    }

    saveScheduleToStorage();

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
        showBulkMessage("");
    }
);

clearStudentsListBtn.addEventListener(
    "click",
    function () {
        bulkStudentsInput.value =
            "";

        clearBulkHighlights();
        clearBulkResult();
        showBulkMessage("");

        bulkStudentsInput.scrollTop = 0;
        bulkStudentsInput.scrollLeft = 0;
        bulkStudentsInput.focus();
    }
);

cancelEditBtn.addEventListener(
    "click",
    function () {
        editingId = null;

        clearStudentFields();
        updateFormMode();
        showMessage("");
    }
);

prevMonthBtn.addEventListener(
    "click",
    function () {
        if (
            isCurrentMonthView()
        ) {
            return;
        }

        currentMonth--;

        if (
            currentMonth < 0
        ) {
            currentMonth = 11;
            currentYear--;
        }

        const beforeCurrentMonth =
            currentYear <
                today.getFullYear() ||
            (
                currentYear ===
                    today.getFullYear() &&
                currentMonth <
                    today.getMonth()
            );

        if (
            beforeCurrentMonth
        ) {
            currentYear =
                today.getFullYear();

            currentMonth =
                today.getMonth();
        }

        resetSelectedDateState();
        renderCalendar();
    }
);

nextMonthBtn.addEventListener(
    "click",
    function () {
        currentMonth++;

        if (
            currentMonth > 11
        ) {
            currentMonth = 0;
            currentYear++;
        }

        resetSelectedDateState();
        renderCalendar();
    }
);

async function copyPromptToClipboard() {
    try {
        await navigator
            .clipboard
            .writeText(
                GPT_PROMPT
            );
    } catch (error) {
        const textarea =
            document.createElement(
                "textarea"
            );

        textarea.value =
            GPT_PROMPT;

        textarea.setAttribute(
            "readonly",
            ""
        );

        textarea.style.position =
            "fixed";

        textarea.style.opacity =
            "0";

        document.body.appendChild(
            textarea
        );

        textarea.select();

        document.execCommand(
            "copy"
        );

        textarea.remove();
    }

    copyPromptBtn.textContent =
        "Копирано";

    copyPromptBtn.classList.add(
        "copied"
    );

    copyPromptStatus.textContent =
        "Prompt-ът е копиран.";

    window.setTimeout(
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

copyPromptBtn.addEventListener(
    "click",
    copyPromptToClipboard
);

window.addEventListener(
    "storage",
    function (event) {
        if (
            event.key !==
            STORAGE_KEY
        ) {
            return;
        }

        schedule =
            loadScheduleFromStorage();

        cleanupPastSchedule();

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
    saveScheduleToStorage
);

document.addEventListener(
    "visibilitychange",
    function () {
        if (
            document.visibilityState ===
            "hidden"
        ) {
            saveScheduleToStorage();
        }
    }
);

if (
    typeof ResizeObserver ===
    "function"
) {
    const calendarResizeObserver =
        new ResizeObserver(
            syncDetailsHeight
        );

    calendarResizeObserver.observe(
        calendarBox
    );
}

schedule =
    loadScheduleFromStorage();

cleanupPastSchedule();

saveScheduleToStorage();

populateTimeOptions();

setFormDisabled(true);

updateFormMode();

clearBulkResult();

renderCalendar();

syncDetailsHeight();