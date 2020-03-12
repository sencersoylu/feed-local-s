const SerialPort = require("serialport");
const Readline = require("@serialport/parser-readline");

import express from "express";
import Cors from "cors";
import bodyParser from "body-parser";
import logger from "morgan";
import Sequelize from "sequelize";
import http from "http";
const dev = 1;
import async from "async";

import SocketIO from "socket.io";

import _ from "lodash";

import axios from "axios";

import nodemailer from "nodemailer";


let last_update = new Date();


const app = express();
let server = http.Server(app);

const sequelize = new Sequelize("sqlite:feed.db");

const API_PORT = process.env.API_PORT || 3000;

let io = new SocketIO(server);
let connections = [];
server.listen(API_PORT, () => console.log(`Listening on port ${API_PORT}`));



let raw_status = 0;
let lines_readed = "";

io.sockets.on("connection", socket => {
  connections.push(socket);
  console.log(" %s sockets is connected", connections.length);
  listUpdate();
  socket.on("disconnect", () => {
    connections.splice(connections.indexOf(socket), 1);
  });
});


app.use(Cors());
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

SerialPort.list(function (err, ports) {
  ports.forEach(function (port) {
    console.log(port.comName);
    if (typeof port.manufacturer != "undefined") {
      if (port.manufacturer.includes('Prolific')) {

        let sport = new SerialPort(port.comName, {
          baudRate: 115200
        });

        sport.on('open', function (err) {
          console.log('Opened', port.comName);
        });

        sport.on('error', function (err) {
          console.log('Error: ', err.message, port.comName)
        });

        let parser = new Readline();
        sport.pipe(parser);

        parser.on('data', line => {
          console.log(line);
          if (line.includes("{")) {

            last_update = Date.now();

            //console.log("rtt");
            let tempdata = JSON.parse(line.replace("@", "D"));
            //console.log(tempdata);
            machineUpdate(tempdata);
          }

        });



      }
    }
  });
});


const machineUpdate = async data => {
  let line = await getLine(data.BASE);
  let machine = data.DEVICE.toString(16);

  if (data.STATUS == 1) {
    let lineslist = await lines();
    console.log(`${line.line} Hattına ${machine} Makinesi Bağlandı`);

    io.sockets.emit("attach", {
      machine: machine.toString(),
      line: line.line,
      lines: lineslist
    });
  } else if (data.STATUS == 2) {
    console.log(`${line.line} Hattına ${machine} Makinesi Bağlı Durumda`);
  }

  sequelize
    .query(
      "UPDATE machines set last_seen = datetime('now','localtime'), line = :line, status = 1 where id = :machine", {
        replacements: {
          machine: machine.toString(),
          line: line.line
        },
        type: sequelize.QueryTypes.UPDATE
      }
    )
    .then(data => {
      return data;
    });
};



const lines = async () => {
  let lines = await sequelize.query("select * from lines order by line desc;", {
    type: sequelize.QueryTypes.SELECT
  });

  return lines;
};

const getWorks = async () => {
  let lines = await sequelize.query("select * from ISEMRI;", {
    type: sequelize.QueryTypes.SELECT
  });

  return lines;
};

const getLine = async id => {
  let line = await sequelize.query("select * from lines where id = :id;", {
    type: sequelize.QueryTypes.SELECT,
    replacements: {
      id: id
    }
  });

  return line[0];
};

const getLineMachines = async line => {
  let machiens = await sequelize.query(
    "select * from machines where line = :line;", {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        line: line
      }
    }
  );

  return machines;
};

const machines = async () => {
  const result = await sequelize.query("select * from machines  ;", {
    type: sequelize.QueryTypes.SELECT
  });

  return result;
};

const machineWork = async () => {
  axios.get("http://10.46.5.112:3001/feed/S").then(response => {
    let machines = response.data;

    sequelize
      .query("DELETE FROM ISEMRI;", {
        type: sequelize.QueryTypes.DELETE
      })
      .then(data => {
        machines.forEach(e => {

          let master = e.detay.find(x => x.DURUMU == "MASTER");

          sequelize
            .query(
              "INSERT INTO ISEMRI (MAK_KODU,ISEMRI_NO,URETILEN_PARCA,MASTER_HAM_MADDE,MASTER_STOK_KODU) VALUES (:MAK_KODU,:ISEMRI_NO,:URETILEN_PARCA,:MASTER_HAM_MADDE,:MASTER_STOK_KODU)", {
                replacements: {
                  MAK_KODU: e.isemri.TEZ_MAS,
                  ISEMRI_NO: e.isemri.ISEMRI_NO,
                  URETILEN_PARCA: e.isemri.ADI,
                  MASTER_HAM_MADDE: master.MLZ_ADI,
                  MASTER_STOK_KODU: master.STOKNO
                },
                type: sequelize.QueryTypes.INSERT
              }
            )
            .then(data => {});
        });
      });

    machines.forEach(e => {
      e.detay.forEach(x => {
        sequelize
          .query(
            "INSERT OR REPLACE INTO ALTER_TABLE (ISEMRI_NO,ALTER_KODU,MALZEME_KODU,ST) VALUES (:ISEMRI_NO,:ALTER_KODU,:MALZEME_KODU,:ST)", {
              replacements: {
                ISEMRI_NO: e.isemri.ISEMRI_NO,
                ALTER_KODU: x.STOKNO,
                MALZEME_KODU: x.UST_STKNO,
                ST: x.DURUMU
              },
              type: sequelize.QueryTypes.INSERT
            }
          )
          .then(data => {});
      });
      sequelize
        .query(
          "UPDATE machines set ISEMRI_NO = :ISEMRI_NO, STOKNO = :STOKNO, ADI = :ADI, KULLANILAN_STOKNO = :KULLANILAN_STOKNO,KULLANILAN_ADI = :KULLANILAN_ADI where machine = :machine", {
            replacements: {
              machine: parseInt(e.isemri.TEZ_MAS.split("-")[1]),
              ISEMRI_NO: e.isemri.ISEMRI_NO,
              STOKNO: e.isemri.STOKNO,
              ADI: e.isemri.ADI,
              KULLANILAN_STOKNO: e.isemri.KULLANILAN_STOKNO,
              KULLANILAN_ADI: e.isemri.KULLANILAN_ADI
            },
            type: sequelize.QueryTypes.UPDATE
          }
        )
        .then(data => {
          return data;
        });
    });
  });
};

const listUpdate = async () => {
  let templines = await lines();
  let listmachines = await machines();
  let works = await getWorks();

  io.sockets.emit("update", {
    lines: templines,
    machines: listmachines,
    works: works
  });
};

const deviceUpdate = async () => {
  let listmachines = await machines();
  let templines = await lines();
  listmachines.forEach(e => {
    let line = templines.find(x => x.line == e.line);

    if (line.raw_material_name != e.KULLANILAN_ADI) {
      sequelize
        .query("UPDATE machines set raw_status = 1 where machine = :machine", {
          replacements: {
            machine: parseInt(e.machine)
          },
          type: sequelize.QueryTypes.UPDATE
        })
        .then(data => {
          //console.log(`${line} Hattında Stok Değiştirildi ${data[0].STOKNO} -- ${data[0].MLZ_ADI}`);
          return data;
        });
    } else {
      sequelize
        .query("UPDATE machines set raw_status = 2 , line ='' where machine = :machine", {
          replacements: {
            machine: parseInt(e.machine)
          },
          type: sequelize.QueryTypes.UPDATE
        })
        .then(data => {
          //console.log(`${line} Hattında Stok Değiştirildi ${data[0].STOKNO} -- ${data[0].MLZ_ADI}`);
          return data;
        });
    }
  });
};


const sendMail = async (adress, subject, message) => {
  var transporter = nodemailer.createTransport({
    service: "hotmail",

    auth: {
      user: "ees.dosab@a-plasltd.com.tr",
      pass: "Zoto9103"
    }
  });

  var mailOptions = {
    from: "ees.dosab@a-plasltd.com.tr",
    to: adress,
    subject: subject,
    html: message
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};


const getLineWorks = async line => {
  const result = await sequelize.query(
    "select ISEMRI_NO from machines where line =:line;", {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        line: line
      }
    }
  );

  return result;
};

const findAlter = async (barcode, arr) => {
  const result = await sequelize.query(
    "select * from ALTER_TABLE where ALTER_KODU =:BARKOD and ISEMRI_NO IN (:ISEMRI) LIMIT 1;", {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        BARKOD: barcode,
        ISEMRI: arr
      }
    }
  );

  return result;
};

setInterval(machineWork, 30000);
setInterval(listUpdate, 30000);


machineWork();