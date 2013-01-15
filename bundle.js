(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {}
});

require.define("/index.js",function(require,module,exports,__dirname,__filename,process,global){var THREE

module.exports = function(three, image, sizeRatio) {
  return new Skin(three, image, sizeRatio)
}

function Skin(three, image, sizeRatio) {
  THREE = three // hack until three.js fixes multiple instantiation
  this.sizeRatio = sizeRatio || 8
  this.createCanvases()
  this.charMaterial = this.getMaterial(this.skin, false)
	this.charMaterialTrans = this.getMaterial(this.skin, true)
  if (typeof image === "string") this.fetchImage(image)
  if (typeof image === "object") this.setImage(image)
}

Skin.prototype.createCanvases = function() {
  this.skinBig = document.createElement('canvas')
	this.skinBigContext = this.skinBig.getContext('2d')
	this.skinBig.width = 64 * this.sizeRatio
	this.skinBig.height = 32 * this.sizeRatio
  
  this.skin = document.createElement('canvas')
	this.skinContext = this.skin.getContext('2d')
	this.skin.width = 64
	this.skin.height = 32
}

Skin.prototype.fetchImage = function(imageURL) {
  var self = this
  this.image = new Image()
  this.image.src = imageURL
  this.image.onload = function() {
    self.setImage(self.image)
  }
}

Skin.prototype.setImage = function (skin) {
  this.image = skin
	this.skinContext.clearRect(0, 0, 64, 32);
	
	this.skinContext.drawImage(skin, 0, 0);
	
	var imgdata = this.skinContext.getImageData(0, 0, 64, 32);
	var pixels = imgdata.data;

	this.skinBigContext.clearRect(0, 0, this.skinBig.width, this.skinBig.height);
	this.skinBigContext.save();
	
	var isOnecolor = true;
	
	var colorCheckAgainst = [40, 0];
	var colorIndex = (colorCheckAgainst[0]+colorCheckAgainst[1]*64)*4;
	
	var isPixelDifferent = function (x, y) {
		if(pixels[(x+y*64)*4+0] !== pixels[colorIndex+0] || pixels[(x+y*64)*4+1] !== pixels[colorIndex+1] || pixels[(x+y*64)*4+2] !== pixels[colorIndex+2] || pixels[(x+y*64)*4+3] !== pixels[colorIndex+3]) {
			return true;
		}
		return false;
	};
	
	// Check if helmet/hat is a solid color
	// Bottom row
	for(var i=32; i < 64; i+=1) {
		for(var j=8; j < 16; j+=1) {
			if(isPixelDifferent(i, j)) {
				isOnecolor = false;
				break;
			}
		}
		if(!isOnecolor) {
			break;
		}
	}
	if(!isOnecolor) {
		// Top row
		for(var i=40; i < 56; i+=1) {
			for(var j=0; j < 8; j+=1) {
				if(isPixelDifferent(i, j)) {
					isOnecolor = false;
					break;
				}
			}
			if(!isOnecolor) {
				break;
			}
			
		}
	}
	
	for(var i=0; i < 64; i+=1) {
	  for(var j=0; j < 32; j+=1) {
  	  if(isOnecolor && ((i >= 32 && i < 64 && j >= 8 && j < 16) || (i >= 40 && i < 56 && j >= 0 && j < 8))) {
  			pixels[(i+j*64)*4+3] = 0
  		}
  		this.skinBigContext.fillStyle = 'rgba('+pixels[(i+j*64)*4+0]+', '+pixels[(i+j*64)*4+1]+', '+pixels[(i+j*64)*4+2]+', '+pixels[(i+j*64)*4+3]/255+')';
  		this.skinBigContext.fillRect(i * this.sizeRatio, j * this.sizeRatio, this.sizeRatio, this.sizeRatio);
  	}
	}
  
	this.skinBigContext.restore();
	
	this.skinContext.putImageData(imgdata, 0, 0);
	
  this.charMaterial.map.needsUpdate = true;
  this.charMaterialTrans.map.needsUpdate = true;
  
  document.body.appendChild(this.skinBig);
	
};

Skin.prototype.getMaterial = function(img, transparent) {
	var texture		= new THREE.Texture(img);
	texture.magFilter	= THREE.NearestFilter;
	texture.minFilter	= THREE.NearestFilter;
	texture.format		= transparent ? THREE.RGBAFormat : THREE.RGBFormat;
	texture.needsUpdate	= true;
	var material	= new THREE.MeshBasicMaterial({
		map		: texture,
		transparent	: transparent ? true : false
	});
	return material;
}

Skin.prototype.UVMap = function(mesh, face, x, y, w, h, rotateBy) {
	if (!rotateBy) rotateBy = 0;
	var uvs = mesh.geometry.faceVertexUvs[0][face];
	var tileU = x;
	var tileV = y;
	var tileUvWidth = 1/64;
	var tileUvHeight = 1/32;
  uvs[ (0 + rotateBy) % 4 ].x = (tileU * tileUvWidth)
  uvs[ (0 + rotateBy) % 4 ].y = 1 - (tileV * tileUvHeight)
  uvs[ (1 + rotateBy) % 4 ].x = (tileU * tileUvWidth)
  uvs[ (1 + rotateBy) % 4 ].y = 1 - (tileV * tileUvHeight + h * tileUvHeight)
  uvs[ (2 + rotateBy) % 4 ].x = (tileU * tileUvWidth + w * tileUvWidth)
  uvs[ (2 + rotateBy) % 4 ].y = 1 - (tileV * tileUvHeight + h * tileUvHeight)
  uvs[ (3 + rotateBy) % 4 ].x = (tileU * tileUvWidth + w * tileUvWidth)
  uvs[ (3 + rotateBy) % 4 ].y = 1 - (tileV * tileUvHeight)
}

Skin.prototype.cubeFromPlanes = function (size, mat) {
	var cube = new THREE.Object3D();
	var meshes = [];
	for(var i=0; i < 6; i++) {
		var mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
		mesh.doubleSided = true;
		cube.add(mesh);
		meshes.push(mesh);
	}
	// Front
	meshes[0].rotation.x = Math.PI/2;
	meshes[0].rotation.z = -Math.PI/2;
	meshes[0].position.x = size/2;
	
	// Back
	meshes[1].rotation.x = Math.PI/2;
	meshes[1].rotation.z = Math.PI/2;
	meshes[1].position.x = -size/2;
	
	// Top
	meshes[2].position.y = size/2;
	
	// Bottom
	meshes[3].rotation.y = Math.PI;
	meshes[3].rotation.z = Math.PI;
	meshes[3].position.y = -size/2;
	
	// Left
	meshes[4].rotation.x = Math.PI/2;
	meshes[4].position.z = size/2;
	
	// Right
	meshes[5].rotation.x = -Math.PI/2;
	meshes[5].rotation.y = Math.PI;
	meshes[5].position.z = -size/2;
	
	return cube;
}

Skin.prototype.createPlayerObject = function(scene) {
  var headgroup = new THREE.Object3D();
	var upperbody = new THREE.Object3D();
	
	// Left leg
	var leftleggeo = new THREE.CubeGeometry(4, 12, 4);
	for(var i=0; i < 8; i+=1) {
		leftleggeo.vertices[i].y -= 6;
	}
	var leftleg = new THREE.Mesh(leftleggeo, this.charMaterial);
	leftleg.position.z = -2;
	leftleg.position.y = -6;
	this.UVMap(leftleg, 0, 8, 20, -4, 12);
	this.UVMap(leftleg, 1, 16, 20, -4, 12);
	this.UVMap(leftleg, 2, 4, 16, 4, 4, 3);
	this.UVMap(leftleg, 3, 8, 20, 4, -4, 1);
	this.UVMap(leftleg, 4, 12, 20, -4, 12);
	this.UVMap(leftleg, 5, 4, 20, -4, 12);

	// Right leg
	var rightleggeo = new THREE.CubeGeometry(4, 12, 4);
	for(var i=0; i < 8; i+=1) {
		rightleggeo.vertices[i].y -= 6;
	}
	var rightleg = new THREE.Mesh(rightleggeo, this.charMaterial);
	rightleg.position.z = 2;
	rightleg.position.y = -6;
  this.UVMap(rightleg, 0, 4, 20, 4, 12);
  this.UVMap(rightleg, 1, 12, 20, 4, 12);
  this.UVMap(rightleg, 2, 8, 16, -4, 4, 3);
  this.UVMap(rightleg, 3, 12, 20, -4, -4, 1);
  this.UVMap(rightleg, 4, 0, 20, 4, 12);
  this.UVMap(rightleg, 5, 8, 20, 4, 12);
	
	// Body
	var bodygeo = new THREE.CubeGeometry(4, 12, 8);
	var bodymesh = new THREE.Mesh(bodygeo, this.charMaterial);
	this.UVMap(bodymesh, 0, 20, 20, 8, 12);
	this.UVMap(bodymesh, 1, 32, 20, 8, 12);
	this.UVMap(bodymesh, 2, 20, 16, 8, 4, 1);
	this.UVMap(bodymesh, 3, 28, 16, 8, 4, 3);
	this.UVMap(bodymesh, 4, 16, 20, 4, 12);
	this.UVMap(bodymesh, 5, 28, 20, 4, 12);
	upperbody.add(bodymesh);
	
	
	// Left arm
	var leftarmgeo = new THREE.CubeGeometry(4, 12, 4);
	for(var i=0; i < 8; i+=1) {
		leftarmgeo.vertices[i].y -= 4;
	}
	var leftarm = new THREE.Mesh(leftarmgeo, this.charMaterial);
	leftarm.position.z = -6;
	leftarm.position.y = 4;
	leftarm.rotation.x = Math.PI/32;
	this.UVMap(leftarm, 0, 48, 20, -4, 12);
	this.UVMap(leftarm, 1, 56, 20, -4, 12);
	this.UVMap(leftarm, 2, 48, 16, -4, 4, 1);
	this.UVMap(leftarm, 3, 52, 16, -4, 4, 3);
	this.UVMap(leftarm, 4, 52, 20, -4, 12);
	this.UVMap(leftarm, 5, 44, 20, -4, 12);
	upperbody.add(leftarm);
	
	// Right arm
	var rightarmgeo = new THREE.CubeGeometry(4, 12, 4);
	for(var i=0; i < 8; i+=1) {
		rightarmgeo.vertices[i].y -= 4;
	}
	var rightarm = new THREE.Mesh(rightarmgeo, this.charMaterial);
	rightarm.position.z = 6;
	rightarm.position.y = 4;
	rightarm.rotation.x = -Math.PI/32;
	this.UVMap(rightarm, 0, 44, 20, 4, 12);
	this.UVMap(rightarm, 1, 52, 20, 4, 12);
	this.UVMap(rightarm, 2, 44, 16, 4, 4, 1);
	this.UVMap(rightarm, 3, 48, 16, 4, 4, 3);
	this.UVMap(rightarm, 4, 40, 20, 4, 12);
	this.UVMap(rightarm, 5, 48, 20, 4, 12);
	upperbody.add(rightarm);
	
	//Head
	var headgeo = new THREE.CubeGeometry(8, 8, 8);
	var headmesh = new THREE.Mesh(headgeo, this.charMaterial);
	headmesh.position.y = 2;
	this.UVMap(headmesh, 0, 8, 8, 8, 8);
	this.UVMap(headmesh, 1, 24, 8, 8, 8);
	
	this.UVMap(headmesh, 2, 8, 0, 8, 8, 1);
	this.UVMap(headmesh, 3, 16, 0, 8, 8, 3);
	
	this.UVMap(headmesh, 4, 0, 8, 8, 8);
	this.UVMap(headmesh, 5, 16, 8, 8, 8);
	headgroup.add(headmesh);

	var helmet = this.cubeFromPlanes(9, this.charMaterialTrans);
	helmet.position.y = 2;
	this.UVMap(helmet.children[0], 0, 32+8, 8, 8, 8);
	this.UVMap(helmet.children[1], 0, 32+24, 8, 8, 8);
	this.UVMap(helmet.children[2], 0, 32+8, 0, 8, 8, 1);
	this.UVMap(helmet.children[3], 0, 32+16, 0, 8, 8, 3);
	this.UVMap(helmet.children[4], 0, 32+0, 8, 8, 8);
	this.UVMap(helmet.children[5], 0, 32+16, 8, 8, 8);
	
	headgroup.add(helmet);
	
	var ears = new THREE.Object3D();
	
	var eargeo = new THREE.CubeGeometry(1, (9/8)*6, (9/8)*6);
	var leftear = new THREE.Mesh(eargeo, this.charMaterial);
	var rightear = new THREE.Mesh(eargeo, this.charMaterial);
	
	leftear.position.y = 2+(9/8)*5;
	rightear.position.y = 2+(9/8)*5;
	leftear.position.z = -(9/8)*5;
	rightear.position.z = (9/8)*5;
	
	// Right ear share same geometry, same uv-maps
	
	this.UVMap(leftear, 0, 25, 1, 6, 6); // Front side
	this.UVMap(leftear, 1, 32, 1, 6, 6); // Back side
	
	this.UVMap(leftear, 2, 25, 0, 6, 1, 1); // Top edge
	this.UVMap(leftear, 3, 31, 0, 6, 1, 1); // Bottom edge
	
	this.UVMap(leftear, 4, 24, 1, 1, 6); // Left edge
	this.UVMap(leftear, 5, 31, 1, 1, 6); // Right edge
	
	ears.add(leftear);
	ears.add(rightear);
	
	leftear.visible = rightear.visible = false;
	
	headgroup.add(ears);
	headgroup.position.y = 8;
	
	var playerModel = new THREE.Object3D();
	
	playerModel.add(leftleg);
	playerModel.add(rightleg);
	
	playerModel.add(upperbody);
	playerModel.add(headgroup);
	
	playerModel.position.y = 6;
	
	var playerGroup = new THREE.Object3D();
	
	playerGroup.add(playerModel);
	return playerGroup
}
});

require.define("/demo.js",function(require,module,exports,__dirname,__filename,process,global){var cw = 400, ch = 550;
var camera = new THREE.PerspectiveCamera(35, cw / ch, 1, 1000);
camera.position.z = 50;
var scene = new THREE.Scene();
scene.add(camera)
var renderer = new THREE.WebGLRenderer({
  antialias: true
})
renderer.setSize(cw, ch)
renderer.setClearColorHex(0xBFD1E5, 1.0)
renderer.clear()
var threecanvas = renderer.domElement;
document.body.appendChild(threecanvas);
var ambientLight, directionalLight
ambientLight = new THREE.AmbientLight(0xaaaaaa)
scene.add(ambientLight)
var light	= new THREE.DirectionalLight( 0xffffff )
light.position.set( Math.random(), Math.random(), Math.random() ).normalize()
scene.add( light )
camera.lookAt(new THREE.Vector3(0, 0, 0))
scene.add(camera)

var mouseX = 0;
var mouseY = 0.1;
var originMouseX = 0;
var originMouseY = 0;

var rad = 0;

var isMouseOver = false;
var isMouseDown = false;

var counter = 0;
var firstRender = true;

var startTime = Date.now();
var pausedTime = 0;
var isRotating = true;
var isPaused = false;
var isYfreezed = false;
var isFunnyRunning = false;

var render = function () {
	window.webkitRequestAnimationFrame(render, renderer.domElement);
	var oldRad = rad;
	
	var time = (Date.now() - startTime)/1000;
	
	if(!isMouseDown) {
		//mouseX*=0.95;
		if(!isYfreezed) {
			mouseY*=0.97;
		}
		if(isRotating) {
			rad += 2;
		}
	}
	else {
		rad = mouseX;
	}
	if(mouseY > 500) {
		mouseY = 500;
	}
	else if(mouseY < -500) {
		mouseY = -500;
	}
	camera.position.x = -Math.cos(rad/(cw/2)+(Math.PI/0.9));
	camera.position.z = -Math.sin(rad/(cw/2)+(Math.PI/0.9));
	camera.position.y = (mouseY/(ch/2))*1.5+0.2;
	camera.position.setLength(70);
	camera.lookAt(new THREE.Vector3(0, 1.5, 0));
		
	renderer.render(scene, camera);
};

render()
var skin = require('./')
var viking = skin(THREE, 'viking.png')
scene.add(viking.createPlayerObject())
});
require("/demo.js");
})();

