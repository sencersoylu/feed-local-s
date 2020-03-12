module.exports = (sequelize, DataTypes) => {
    const ISEMRI = sequelize.define('ISEMRI', {
        MAK_KODU: {
            type: DataTypes.STRING,
        },
        ISEMRI_NO: {
            type: DataTypes.STRING,
        },
        URETILEN_PARCA: {
            type: DataTypes.STRING,
        },
        HAM_MADDE: {
            type: DataTypes.STRING
        }
    });

    return ISEMRI;
};