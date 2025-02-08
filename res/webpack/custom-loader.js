const path = require("path");

module.exports = function(content){

    const ClassName = path.basename(this.resourcePath).replace(/(\.[\w\d]+)$/i, '');
    const dirname = __dirname.split("\\").join("/");
    const classPath = this.resourcePath.split("\\").join("/").split(dirname + "/dist/").join("").replace(/(\.[\w\d]+)$/i, '');
    content += "try { " + ClassName + ".___PATH___ = \"" + classPath + "\"; } catch(error){}";
    console.log("    " + classPath);
    return content;
};