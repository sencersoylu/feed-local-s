const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

import express from 'express';
import Cors from 'cors';
import bodyParser from 'body-parser';
import logger from 'morgan';
import Sequelize from 'sequelize';
import http from 'http';

import SocketIO from 'socket.io';

import _ from 'lodash';

import axios from 'axios';

const app = express();
let server = http.Server(app);

const sequelize = new Sequelize('sqlite:feed.db');

const API_PORT = process.env.API_PORT || 3000;

let io = new SocketIO(server);
let connections = [];


app.use(Cors());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());
app.use(logger('dev'));

server.listen(API_PORT, () => console.log(`Listening on port ${API_PORT}`));

app.get('/', function (req, res) {
    sequelize.query("SELECT * FROM `machines`", {
            type: sequelize.QueryTypes.SELECT
        })
        .then(data => {
            res.json(data);
            // We don't need spread here, since only the results will be returned for select queries
        })

});

let raw_status = 0;
let lines_readed = "";


io.sockets.on('connection', (socket) => {
    connections.push(socket);
    console.log(' %s sockets is connected', connections.length);

    socket.on('disconnect', () => {
        connections.splice(connections.indexOf(socket), 1);
    });
});


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
                    let tempdata = JSON.parse(line);
                    console.log(tempdata);
                    machineUpdate(tempdata);
                });



            }

            if (port.manufacturer.includes('FTDI')) {

                let sport = new SerialPort(port.comName, {
                    baudRate: 9600
                });

                sport.on('open', function (err) {
                    console.log('Opened', port.comName);
                });

                sport.on('error', function (err) {
                    console.log('Error: ', err.message, port.comName)
                });

                sport.on('data', function (data) {
                    //let buf = new Buffer.From(data);
                    const barcode = data.toString('utf8').trim();
                    if (raw_status == 0) {
                        if (barcode == 'A' || barcode == 'B' || barcode == 'C' || barcode == 'D' || barcode == 'E') {
                            console.log(`${barcode} Hat Barkodu Okutuldu`);
                            lines_readed = barcode;
                            raw_status = 1;
                            io.sockets.emit('linebarcode', barcode);
                        }
                    } else if (raw_status == 1) {
                        axios.post('http://10.46.5.112:3001/feed/GetStock', {
                                STOCK_NO: barcode
                            })
                            .then(function (response) {
                                console.log(response.data);
                                rawChange(response.data, lines_readed);
                                raw_status = 0;
                                io.sockets.emit('rawbarcode', {
                                    raw: response.data,
                                    line: lines_readed
                                });

                            })
                            .catch(function (error) {
                                //console.log(error);
                                if (error.response.status == "404") {
                                    if (error.response.data == "NOK")
                                        console.log("Böyle bir stok bulunamadı");
                                    raw_status = 0;

                                }
                                raw_status = 0;
                            });

                    }

                    //console.log(data.toString('utf8'));
                });




            }
        }
    });
});

const rawChange = (raw, line) => {

    sequelize
        .query(
            "UPDATE lines set raw_material_name = :stock_name, raw_material_code = :stock_code, last_change = datetime('now','localtime') where line = :line", {
                replacements: {
                    stock_code: raw[0].STOKNO,
                    stock_name: raw[0].MLZ_ADI,
                    line: line
                },
                type: sequelize.QueryTypes.UPDATE
            }
        )
        .then(data => {
            console.log(`${line} Hattında Stok Değiştirildi ${raw[0].STOKNO} -- ${raw[0].MLZ_ADI}`);
            return data;
        });

}

const machineUpdate = async (data) => {

    let line = "";
    if (data.BASE == "1")
        line = "A";
    else if (data.BASE == "2")
        line = "B";
    else if (data.BASE == "3")
        line = "C";
    else if (data.BASE == "4")
        line = "D";
    else if (data.BASE == "5")
        line = "E";
    else
        return 0;

    if (data.status == 1) {
        let data = await lineStatus();
        console.log(`${line} Hattına ${data.DEVICE + 100} Makinesi Bağlandı`);
        io.sockets.emit('attach', {
            macihne: (data.DEVICE + 100).toString(),
            line: line,
            lines: data
        });
    } else if (data.status == 2) {
        console.log(`${line} Hattına ${data.DEVICE + 100} Makinesi Bağlı Durumda`);
    }

    sequelize
        .query(
            "UPDATE machines set last_seen = datetime('now','localtime'), line = :line, status = 1 where machine = :machine", {
                replacements: {
                    machine: (data.DEVICE + 100).toString(),
                    line: line
                },
                type: sequelize.QueryTypes.UPDATE
            }
        )
        .then(data => {
            //console.log(`${line} Hattında Stok Değiştirildi ${data[0].STOKNO} -- ${data[0].MLZ_ADI}`);
            return data;
        });

}

const lines = async () => {

    let lines = await sequelize
        .query(
            "select * from lines;", {
                type: sequelize.QueryTypes.SELECT
            }
        );

    return lines;


}




const machines = async () => {

    const result = await sequelize.query("select * from machines ;", {
        type: sequelize.QueryTypes.SELECT,
    });

    return result;

}

const listUpdate = async () => {

    let templines = await lines();
    let listmachines = await machines();

    io.sockets.emit('update', {
        lines: templines,
        machines: listmachines
    });

}

const deviceUpdate = async () => {



    sequelize
        .query(
            "SELECT machine FROM machines WHERE status = 1 and last_seen < datetime(datetime('now','localtime'),'-1 minutes');", {
                type: sequelize.QueryTypes.SELECT
            }
        ).then((data) => {
            data.map(async (xdata) => {

                sequelize
                    .query(
                        "UPDATE machines set status = 0  where machine = :machine", {
                            replacements: {
                                machine: xdata.machine
                            },
                            type: sequelize.QueryTypes.UPDATE
                        }
                    )
                    .then(async () => {

                        let data = await lineStatus();

                        io.sockets.emit('detach', {
                            machine: xdata.machine,
                            lines: data
                        });
                        console.log(`${xdata.machine} Bulunamadı`);
                    });




            })

        });



}

setInterval(listUpdate, 10000);

setInterval(deviceUpdate, 5000);


module.exports = app;