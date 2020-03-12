module.exports = (sequelize, DataTypes) => {
    const machines = sequelize.define('machines', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        machine: {
            type: DataTypes.TEXT,
        },
        line: {
            type: DataTypes.TEXT,
        },
        last_seen: {
            type: DataTypes.TEXT
        },
        status: {
            type: DataTypes.TEXT
        },
        ISEMRI_NO: {
            type: DataTypes.TEXT
        },
        STOKNO: {
            type: DataTypes.TEXT
        },
        ADI: {
            type: DataTypes.TEXT
        },
        KULLANILAN_STOKNO: {
            type: DataTypes.TEXT
        },
        KULLANILAN_ADI: {
            type: DataTypes.TEXT
        },
        raw_status: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
    });

    return machines;
};