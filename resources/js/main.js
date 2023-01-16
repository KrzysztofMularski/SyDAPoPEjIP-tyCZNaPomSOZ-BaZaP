function onWindowClose() {
  Neutralino.app.exit();
}

const envs = {
  XATA_API_KEY: "xau_R8NvUEAUsm0NfkXEoeg1Wgrap9aSg1fw0",
  DB_URL:
    "https://krzysztof-mularski-s-workspace-1ou6nq.us-east-1.xata.sh/db/bazap:main/tables/measurements",
};

const setEnvVars = async () => {
  const content = await Neutralino.filesystem.readFile(
    "./resources/js/.env-local"
  );
  content.split("\r\n").forEach((s) => {
    const [key, value] = s.split("=");
    envs[key] = value;
  });
};

const fetchAllRecords = async (size, sort, filter) => {
  const body = {
    page: {
      size: size,
    },
    sort: sort,
    filter: filter,
  };
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${envs.XATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };

  try {
    console.log(options);
    let response = await fetch(`${envs.DB_URL}/query`, options);
    response = await response.json();
    let arr = response.records;

    arr = arr.map(({ id, measured_time, date, driveType }) => {
      return {
        id: id,
        measuredTime: measured_time,
        date: date,
        driveType: driveType,
      };
    });
    return arr.reverse();
  } catch (err) {
    console.log(err);
  }
  return null;
};

const getAllRecords = async () => {
  const pomiary = document.getElementById("pomiary");
  const body = {
    page: {
      size: 15,
    },
    sort: {
      date: "desc",
    },
  };
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${envs.XATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };

  try {
    let response = await fetch(`${envs.DB_URL}/query`, options);
    response = await response.json();
    let arr = response.records;

    arr = arr.map(
      ({ measured_time, date }, id) =>
        `<p>${id}. ${measured_time} (${date})</p>`
    );
    pomiary.innerHTML = arr.join(" ");
  } catch (err) {
    console.log(err);
  }
};

const insertRecord = async (time, seriaId, date, driveType) => {
  time = parseFloat(time);
  const body = {
    measured_time: time,
    date,
    seriaId,
    driveType,
  };
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${envs.XATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
  try {
    await fetch(`${envs.DB_URL}/data?columns=id`, options);
  } catch (err) {
    console.log(err);
  }
};

let pomiarId;
let seriaId;
async function enterPomiarsLoop() {
  const liczba_iteracji = 10;
  seriaId = Date.now();

  for (let i = 0; i < liczba_iteracji; i++) {
    const pomiar = await Neutralino.os.spawnProcess(
      "cd pythonBenchmark && python ./main.py"
    );
    pomiarId = pomiar.id;
    await sleep(10000);
  }
  return;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getCdDriveType = async () => {
  let typDysku = await Neutralino.filesystem.readFile(
    "./pythonBenchmark/CurrentDrive.txt",
    {}
  );
  typDysku = typDysku.trim();

  return typDysku;
  // return "TSSTcorp CDDVDW SH-216DB";
  // return "nie ma takiego";
};

async function ogarnijWynikiPomiaru(czas) {
  let dataPom = Date.now();
  let typDysku = await getCdDriveType();
  let toSave = `${czas};${seriaId};${dataPom};${typDysku}\n`;
  await Neutralino.filesystem.appendFile(
    "./pythonBenchmark/CDbenchmark.txt",
    toSave
  );
  await insertRecord(czas, seriaId, dataPom, typDysku);
}
function onPomiar() {
  enterPomiarsLoop();
}

Neutralino.init();
setEnvVars();

(() => {
  const container = document.getElementById("intro-container");
  const intro = document.getElementById("intro");
  const containerWidth = container.offsetWidth;
  const width = intro.offsetWidth;
  let offset = 0;
  setInterval(() => {
    if (width < containerWidth) {
      if (offset < -width) {
        offset = containerWidth;
      }
      intro.style = `translate: ${offset}px`;
      offset -= 16;
    }
  }, 400);
})();

Neutralino.events.on("windowClose", onWindowClose);

Neutralino.events.on("spawnedProcess", (evt) => {
  if (pomiarId == evt.detail.id) {
    switch (evt.detail.action) {
      case "stdOut":
        let log = evt.detail.data;
        log = log.replace("\n", "");
        log = log.replace("\r", "");
        log = log.replace(" ", "");
        ogarnijWynikiPomiaru(log);
        console.log(log);
        break;
      case "stdErr":
        console.error(evt.detail.data);
        break;
      case "exit":
        console.log(`Pomiar się zakończył z kodem: ${evt.detail.data}`);
        break;
    }
  }
});
