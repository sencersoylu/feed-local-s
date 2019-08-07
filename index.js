const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

import express from 'express';
import Cors from 'cors';
import bodyParser from 'body-parser';
import logger from 'morgan';
import Sequelize from 'sequelize';

import axios from 'axios';

const app = express();

const sequelize = new Sequelize('sqlite:feed.db');

const API_PORT = process.env.API_PORT || 3000;

app.use(Cors());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());
app.use(logger('dev'));

app.listen(API_PORT, () => console.log(`Listening on port ${API_PORT}`));

app.get('/', function (req, res) {
    res.send('OK');
});

let raw_status = 0;
let lines_readed = "";


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
                        }
                    } else if (raw_status == 1) {
                        axios.post('http://10.46.5.112:3001/feed/GetStock', {
                                STOCK_NO: barcode
                            })
                            .then(function (response) {
                                console.log(response.data);
                                rawChange(response.data, lines_readed);
                                raw_status = 0;
                            })
                            .catch(function (error) {
                                //console.log(error.response.status);
                                if (error.response.status == "404") {
                                    if (error.response.data == "NOK")
                                        console.log("Böyle bir stok bulunamadı");
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
            "UPDATE lines set raw_material_name = :stock_name, raw_material_code = :stock_code, last_change = datetime('now') where line = :line", {
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

const machineUpdate = (data) => {

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
        console.log(`${line} Hattına ${data.DEVICE + 100} Makinesi Bağlandı`);
    } else if (data.status == 2) {
        console.log(`${line} Hattına ${data.DEVICE + 100} Makinesi Bağlı Durumda`);
    }

    sequelize
        .query(
            "UPDATE machines set last_seen = datetime('now') where machine = :machine", {
                replacements: {
                    machine: data.DEVICE + 100,
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




module.exports = app;