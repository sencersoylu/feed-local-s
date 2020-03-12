module.exports = (sequelize, DataTypes) => {
    const lines = sequelize.define('lines', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        line: {
            type: DataTypes.TEXT,
        },
        last_change: {
            type: DataTypes.TEXT,
        },
        raw_material_name: {
            type: DataTypes.TEXT
        },
        raw_material_code: {
            type: DataTypes.TEXT
        },
        READED_BARCODE: {
            type: DataTypes.TEXT
        }
    });

    return lines;
};