module.exports = (sequelize, DataTypes) => {
    const ALTER_TABLE = sequelize.define('ALTER_TABLE', {
        ISEMRI_NO: {
            type: DataTypes.STRING,
        },
        MALZEME_KODU: {
            type: DataTypes.STRING,
        },
        ALTER_KODU: {
            type: DataTypes.STRING
        },
        st: {
            type: DataTypes.STRING
        }
    });

    return ALTER_TABLE;
};