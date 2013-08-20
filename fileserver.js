var http = require("http");
var fs = require("fs");
var urllib = require("url");
var pathModule = require("path");

var express = require("express");
var mime = require("mime");
var cheerio = require("cheerio");

var app = express();
// Settings
app.set("baseURL", "/home/petschekr/Videos/");
app.enable("transcoding");
app.enable("print-root-directory");

var isNumber = function (n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}
function getHTMLForPath (path) {
	origPath = path;
	if (path !== "") {
		path += "/";
	}
	var files = fs.readdirSync(app.get("baseURL") + path);
	var dirlist = []
	var filelist = []
	for (var i = 0; i < files.length; i++) {
		stats = fs.statSync(app.get("baseURL") + path + files[i]);
		if (stats.isDirectory()) {
			// File is a directory
			dirlist.push(files[i]);
		}
		else if (stats.isFile()) {
			// File is a file (NO WAY!!)
			filelist.push(files[i]);
		}
	}
	var html = "";
	if (origPath !== "") {
		abovePath = pathModule.join(origPath, "../");
		if (abovePath !== "") {
			abovePath = 'dir/' + abovePath;
		}
		html += '<a href="/' + abovePath + '"><i><b>Go up</b></i></a><br /><br />';
	}
	for (var i = 0; i < dirlist.length; i++) {
		html += '<a href="/dir/' + path + dirlist[i] + '"><b>' + dirlist[i] + '/</b></a><br />';
	}
	for (var i = 0; i < filelist.length; i++) {
		html += '<a href="/file/' + path + filelist[i] + '">' + filelist[i] + '</a><br />';
	}
	return html;
}

// Serve the root directory
app.get("/", function (request, response) {
	response.redirect("/dir/");
});

// List out subdirectories
app.get("/dir/*", function (request, response) {
	var zepath = request.params[0];
	response.send(getHTMLForPath(zepath));
});

// Returns a raw media stream that can be used with an HTML5 video player
app.get("/media/*", function (request, response) {
	var zefile = request.params[0];
	var zemime = mime.lookup(zefile);

	var range = typeof request.headers.range === "string" ? request.headers.range : undefined;
	var reqUrl = urllib.parse(request.url, true);

	var zeStat = fs.statSync(app.get("baseURL") + zefile);
	var vidStart = 0;
	var vidEnd = zeStat.size - 1;
	var vidSize = zeStat.size;
	var vidLastMod = zeStat.mtime;
	var rangeRequest = false;

	var code = 200;
	var header;
	
	if (range !== undefined && (range = range.match(/bytes=(.+)-(.+)?/)) !== null) {
		// Check range contains numbers and they fit in the file.
		// Make sure info.start & info.end are numbers (not strings) or stream.pipe errors out if start > 0.
		vidStart = isNumber(range[1]) && range[1] >= 0 && range[1] < vidEnd ? range[1] - 0 : vidStart;
		vidEnd = isNumber(range[2]) && range[2] > vidStart && range[2] <= vidEnd ? range[2] - 0 : vidEnd;
		rangeRequest = true;
	} else if (reqUrl.query.start || reqUrl.query.end) {
		// This is a range request, but doesn't get range headers. So there.
		vidStart = isNumber(reqUrl.query.start) && reqUrl.query.start >= 0 && reqUrl.query.start < vidEnd ? reqUrl.query.start - 0 : vidStart;
		vidEnd = isNumber(reqUrl.query.end) && reqUrl.query.end > vidStart && reqUrl.query.end <= vidEnd ? reqUrl.query.end - 0 : vidEnd;
	}

	var vidLength = vidEnd - vidStart + 1;
	
	var filename = zefile.split("/");
	filename = filename[filename.length - 1];
	header = {
		"Cache-Control": "public",
		"Connection": "keep-alive",
		"Content-Type": zemime,
		"Content-Disposition": "inline; filename=\"" + filename + "\";"
	};

	if (rangeRequest) {
		// Partial http response
		code = 206;
		header.Status = "206 Partial Content";
		header["Accept-Ranges"] = "bytes";
		header["Content-Range"] = "bytes " + vidStart + "-" + vidEnd + "/" + vidSize;
	}

	header.Pragma = "public";
	header["Last-Modified"] = vidLastMod.toUTCString();
	header["Content-Transfer-Encoding"] = "binary";
	header["Content-Length"] = vidLength;

	response.writeHead(code, header);

	var vidStream = fs.createReadStream(app.get("baseURL") + zefile, {flags: "r", start: vidStart, end: vidEnd});
	vidStream.pipe(response);
});

PORT = 32200;
app.listen(PORT, function() {
	console.log("The server is listening on port " + PORT);
});
