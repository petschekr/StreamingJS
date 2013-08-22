var http = require("http");
var fs = require("fs");
var urllib = require("url");
var pathModule = require("path");

var express = require("express");
var mime = require("mime");
var cheerio = require("cheerio");
var marked = require("marked");
var pygmentize = require("pygmentize-bundled");

var app = express();
// Settings
app.set("baseURL", "/home/petschekr/Videos/");
app.disable("hidden-files");
app.enable("markdown");

app.enable("transcoding");
app.enable("print-root-directory");

var isNumber = function (n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
};
function readableSize (size) {
	var origSize = size;
	var unitSize = 1024;
	var unitIndex = 0;
	var units = ["bytes", "KiB", "MiB", "GiB", "TiB", "PiB"]
	while (size >= unitSize) {
		unitIndex++;
		size /= unitSize;
	}
	if (unitIndex >= units.length) {
		// Exceeded labels
		unitIndex = 0;
		size = origSize;
	}
	return size.toFixed(2) + " " + units[unitIndex];
}
function getHTMLForPath (path) {
	// Check if path is higher than it should be
	var compiledPath = pathModule.join(app.get("baseURL"), path);
	if (!compiledPath.match(new RegExp("^" + app.get("baseURL")))) {
		// Failed the path check
		return false;
	}

	var origPath = path;
	if (path !== "") {
		path += "/";
	}
	var files = fs.readdirSync(app.get("baseURL") + path);
	var dirlist = []
	var filelist = []
	for (var i = 0; i < files.length; i++) {
		if (pathModule.basename(path + files[i])[0] === "." && app.enabled("hidden-files")) {
			continue;
		}
		var stats = fs.statSync(app.get("baseURL") + path + files[i]);
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
		var abovePath = pathModule.join(origPath, "../");
		if (abovePath !== "") {
			abovePath = 'dir/' + abovePath;
		}
		html += '<a href="/' + abovePath + '"><i><b>Go up</b></i></a><br /><br />';
	}
	for (var i = 0; i < dirlist.length; i++) {
		var style = "";
		if (pathModule.basename(path + dirlist[i])[0] === ".") {
			style = "opacity: 0.6;";
		}
		html += '<a style="' + style + '" href="/dir/' + path + dirlist[i] + '"><b>' + dirlist[i] + '/</b></a><br />';
	}
	for (var i = 0; i < filelist.length; i++) {
		var style = "";
		if (pathModule.basename(path + filelist[i])[0] === ".") {
			style = "opacity: 0.6;";
		}
		html += '<a style="' + style + '" href="/file/' + path + filelist[i] + '">' + filelist[i] + '</a><br />';
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
	var htmlToSend = getHTMLForPath(zepath);
	if (htmlToSend === false) {
		response.redirect("/dir/");
	}
	else {
		response.send(getHTMLForPath(zepath));
	}
});
// Returns file information
app.get("/file/*", function (request, response) {
	var zefile = request.params[0];
	zefile = pathModule.basename(zefile);
	var htmldoc = fs.readFileSync("file.html", {encoding: "utf8"});
	$ = cheerio.load(htmldoc);
	$("title").text(zefile);
	$("h1").text(zefile);
	var mimeType = mime.lookup(zefile);
	var videoType = mimeType.split("/")[0];
	if (videoType === "video" || videoType === "audio") {
		videoType = "Stream " + videoType;
		$("div > a").text(videoType).attr("href", "/stream/" + request.params[0]);
		continueResponse();
	}
	else if (videoType === "image") {
		fs.readFile(app.get("baseURL") + request.params[0], function (err, image) {
			if (err)
				return
			image = image.toString("base64");
			var dataURI = "data:" + mimeType + ";base64," + image;
			var staticLink = "/raw/" + request.params[0];
			$("div").html('<a href="' + staticLink + '"><img style="max-width:100%;" alt="' + zefile + '" src="' + dataURI + '" /></a>');
			$("body").attr("style", "padding-bottom: 0;");
			continueResponse();
		});
	}
	else if (mimeType === "text/x-markdown") {
		fs.readFile(app.get("baseURL") + request.params[0], {encoding: "utf8"}, function (err, markdown) {
			if (err)
				return
			var MDoptions = {
				gfm: false,
				smartypants: true,
				highlight: function (code, lang, callback) {
					pygmentize({lang:lang, format:"html"}, code, function (err, result) {
						if (err)
							return callback(err);
						callback(null, result.toString());
					});
				}
			};
			marked(markdown, MDoptions, function (err, content) {
				if (err) {
					console.error(err);
					var staticLink = "/raw/" + request.params[0];
					$("div > a").text("View raw").attr("href", staticLink);
					continueResponse();
					return;
				}
				$("div").html(content).attr("style", "max-height: 500px; overflow: scroll;");
				continueResponse();
			});
		});
	}
	else {
		var staticLink = "/raw/" + request.params[0];
		$("div > a").text("View raw").attr("href", staticLink);
		continueResponse();
	}
	function continueResponse() {
		fs.stat(app.get("baseURL") + request.params[0], function (err, stats) {
			if (err) {
				// File doesn't exist
				response.send("<b>" + request.params[0] + "</b> doesn't exist");
				return
			}
			$("#mime").text(mimeType);
			$("#ctime").text(stats.ctime.toString());
			$("#size").text(readableSize(stats.size));
			response.send($.html());
		});
	}
});
app.get("/raw/*", function (request, response) {
	var zefile = request.params[0];
	var mimeType = mime.lookup(zefile);
	fs.readFile(app.get("baseURL") + zefile, function (err, file) {
		if (err) {
			response.send("Couldn't retrieve the requested file");
			return
		}
		response.type(mimeType);
		response.send(file);
	});
});

// Returns a raw media stream that can be used with an HTML5 video player
app.get("/stream/*", function (request, response) {
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

PORT = 8080;
app.listen(PORT, function() {
	console.log("The server is listening on port " + PORT);
});