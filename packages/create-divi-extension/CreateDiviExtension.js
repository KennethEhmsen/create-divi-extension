/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//   /!\ DO NOT MODIFY THIS FILE /!\
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// create-divi-extension is installed globally on people's computers. This means
// that it is extremely difficult to have them upgrade the version and
// because there's only one global version installed, it is very prone to
// breaking changes.
//
// The only job of create-divi-extension is to init the repository and then
// forward all the commands to the local version of create-divi-extension.
//
// If you need to add a new command, please add it to the scripts/ folder.
//
// The only reason to modify this file is to add more warnings and
// troubleshooting information for the `create-divi-extension` command.
//
// Do not make breaking changes! We absolutely don't want to have to
// tell people to update their global version of create-divi-extension.
//
// Also be careful with new language features.
// This file must work on Node 6+.
//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//   /!\ DO NOT MODIFY THIS FILE /!\
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

'use strict';

const validateProjectName = require( 'validate-npm-package-name' );
const chalk               = require( 'chalk' );
const commander           = require( 'commander' );
const fs                  = require( 'fs-extra' );
const path                = require( 'path' );
const execSync            = require( 'child_process' ).execSync;
const spawn               = require( 'cross-spawn' );
const semver              = require( 'semver' );
const dns                 = require( 'dns' );
const tmp                 = require( 'tmp' );
const unpack              = require( 'tar-pack' ).unpack;
const hyperquest          = require( 'hyperquest' );

const packageJson = require( './package.json' );
const template    = path.join( __dirname, 'template' );

let projectName;

const program = new commander.Command( packageJson.name )
	.version( packageJson.version )
	.arguments( '<project-directory>' )
	.usage( `${chalk.green( '<project-directory>' )} [options]` )
	.action( name => {
		projectName = name;
	} )
	.option( '--verbose', 'print additional logs' )
	.option(
		'--scripts-version <alternative-package>',
		'use a non-standard version of react-scripts'
	)
	.allowUnknownOption()
	.on( '--help', () => {
		console.log( `    Only ${chalk.green( '<project-directory>' )} is required.` );
		console.log();
		console.log(
			`    A custom ${chalk.cyan( '--scripts-version' )} can be one of:`
		);
		console.log( `      - a specific npm version: ${chalk.green( '0.8.2' )}` );
		console.log(
			`      - a custom fork published on npm: ${chalk.green( 'my-react-scripts' )}`
		);
		console.log(
			`      - a .tgz archive: ${chalk.green( 'https://mysite.com/my-react-scripts-0.8.2.tgz' )}`
		);
		console.log(
			`    It is not needed unless you specifically want to use a fork.`
		);
		console.log();
		console.log(
			`    If you have any problems, do not hesitate to file an issue:`
		);
		console.log(
			`      ${chalk.cyan( 'https://github.com/lots0logs/create-divi-extension/issues/new' )}`
		);
		console.log();
	} )
	.parse( process.argv );

if ( typeof projectName === 'undefined' ) {
	console.error( 'Please specify the project directory:' );
	console.log(
		`  ${chalk.cyan( program.name() )} ${chalk.green( '<project-directory>' )}`
	);
	console.log();
	console.log( 'For example:' );
	console.log( `  ${chalk.cyan( program.name() )} ${chalk.green( 'my-react-app' )}` );
	console.log();
	console.log(
		`Run ${chalk.cyan( `${program.name()} --help` )} to see all options.`
	);
	process.exit( 1 );
}

function printValidationResults( results ) {
	if ( typeof results !== 'undefined' ) {
		results.forEach( error => {
			console.error( chalk.red( `  *  ${error}` ) );
		} );
	}
}

createApp( projectName, program.verbose, program.scriptsVersion );

function createApp( name, verbose, version ) {
	const root    = path.resolve( name );
	const appName = path.basename( root );

	checkAppName( appName );
	fs.ensureDirSync( name );
	if ( !isSafeToCreateProjectIn( root ) ) {
		console.log(
			`The directory ${chalk.green( name )} contains files that could conflict.`
		);
		console.log( 'Try using a new directory name.' );
		process.exit( 1 );
	}

	console.log( `Creating a new Divi extension in ${chalk.green( root )}.` );
	console.log();

	const packageJson = {
		name: appName,
		version: '0.1.0',
		private: true,
	};
	fs.writeFileSync(
		path.join( root, 'package.json' ),
		JSON.stringify( packageJson, null, 2 )
	);
	const originalDirectory = process.cwd();
	process.chdir( root );

	if ( !semver.satisfies( process.version, '>=6.0.0' ) ) {
		console.log(
			chalk.yellow(
				`You are using Node ${process.version} so the project will be boostrapped with an old unsupported version of tools.\n\n` +
				`Please update to Node 6 or higher for a better, fully supported experience.\n`
			)
		);
		// Fall back to latest supported react-scripts on Node 4
		version = 'react-scripts@0.9.x';
	}

	const useYarn = shouldUseYarn();
	if ( !useYarn ) {
		const npmInfo = checkNpmVersion();
		if ( !npmInfo.hasMinNpm ) {
			if ( npmInfo.npmVersion ) {
				console.log(
					chalk.yellow(
						`You are using npm ${npmInfo.npmVersion} so the project will be boostrapped with an old unsupported version of tools.\n\n` +
						`Please update to npm 3 or higher for a better, fully supported experience.\n`
					)
				);
			}
			// Fall back to latest supported react-scripts for npm 3
			version = 'react-scripts@0.9.x';
		}
	}
	run( root, appName, version, verbose, originalDirectory, template, useYarn );
}

function shouldUseYarn() {
	try {
		execSync( 'yarnpkg --version', { stdio: 'ignore' } );
		return true;
	} catch ( e ) {
		return false;
	}
}

function install( useYarn, dependencies, verbose, isOnline ) {
	return new Promise( ( resolve, reject ) => {
		let command;
		let args;
		if ( useYarn ) {
			command = 'yarnpkg';
			args    = ['add', '--exact'];
			if ( !isOnline ) {
				args.push( '--offline' );
			}
			[].push.apply( args, dependencies );

			if ( !isOnline ) {
				console.log( chalk.yellow( 'You appear to be offline.' ) );
				console.log( chalk.yellow( 'Falling back to the local Yarn cache.' ) );
				console.log();
			}
		} else {
			command = 'npm';
			args    = ['install', '--save', '--save-exact'].concat( dependencies );
		}

		if ( verbose ) {
			args.push( '--verbose' );
		}

		const child = spawn( command, args, { stdio: 'inherit' } );
		child.on( 'close', code => {
			if ( code !== 0 ) {
				reject( {
					command: `${command} ${args.join( ' ' )}`,
				} );
				return;
			}
			resolve();
		} );
	} );
}

function run( root, appName, version, verbose, originalDirectory, template, useYarn ) {
	const packageToInstall = getInstallPackage( version );
	const allDependencies  = ['react', 'react-dom', packageToInstall];

	console.log( 'Installing packages. This might take a couple minutes.' );
	getPackageName( packageToInstall )
		.then( packageName => checkIfOnline( useYarn ).then( isOnline => ({
			isOnline: isOnline,
			packageName: packageName,
		}) ) )
		.then( info => {
			const isOnline    = info.isOnline;
			const packageName = info.packageName;
			console.log(
				`Installing ${chalk.cyan( 'react' )}, ${chalk.cyan( 'react-dom' )}, and ${chalk.cyan( packageName )}...`
			);
			console.log();

			return install( useYarn, allDependencies, verbose, isOnline ).then(
				() => packageName
			);
		} )
		.then( packageName => {
			checkNodeVersion( packageName );

			// Since react-scripts has been installed with --save
			// we need to move it into devDependencies and rewrite package.json
			// also ensure react dependencies have caret version range. We also need
			// to move react and react-dom to devDependencies because we don't want them
			// included in production bundles.
			fixDependencies( packageName );

			const scriptsPath = path.resolve(
				process.cwd(),
				'node_modules',
				packageName,
				'scripts',
				'init.js'
			);

			const init        = require( scriptsPath );
			init( root, appName, verbose, originalDirectory, template );

			finalize_extension_files( root, appName );

			if ( version === 'react-scripts@0.9.x' ) {
				console.log(
					chalk.yellow(
						`\nNote: the project was boostrapped with an old unsupported version of tools.\n` +
						`Please update to Node >=6 and npm >=4 to get supported tools in new projects.\n`
					)
				);
			}
		} )
		.catch( reason => {
			console.log();
			console.log( 'Aborting installation.' );
			if ( reason.command ) {
				console.log( `  ${chalk.cyan( reason.command )} has failed.` );
			} else {
				console.log( chalk.red( 'Unexpected error. Please report it as a bug:' ) );
				console.log( reason );
			}
			console.log();

			// On 'exit' we will delete these files from target directory.
			const knownGeneratedFiles = [
				'package.json',
				'npm-debug.log',
				'yarn-error.log',
				'yarn-debug.log',
				'node_modules',
			];
			const currentFiles        = fs.readdirSync( path.join( root ) );
			currentFiles.forEach( file => {
				knownGeneratedFiles.forEach( fileToMatch => {
					// This will catch `(npm-debug|yarn-error|yarn-debug).log*` files
					// and the rest of knownGeneratedFiles.
					if (
						(fileToMatch.match( /.log/g ) && file.indexOf( fileToMatch ) === 0) ||
						file === fileToMatch
					) {
						console.log( `Deleting generated file... ${chalk.cyan( file )}` );
						fs.removeSync( path.join( root, file ) );
					}
				} );
			} );
			const remainingFiles = fs.readdirSync( path.join( root ) );
			if ( !remainingFiles.length ) {
				// Delete target folder if empty
				console.log(
					`Deleting ${chalk.cyan( `${appName} /` )} from ${chalk.cyan( path.resolve( root, '..' ) )}`
				);
				process.chdir( path.resolve( root, '..' ) );
				fs.removeSync( path.join( root ) );
			}
			console.log( 'Done.' );
			process.exit( 1 );
		} );
}

function getInstallPackage( version ) {
	let packageToInstall = 'react-scripts';
	const validSemver    = semver.valid( version );
	if ( validSemver ) {
		packageToInstall += `@${validSemver}`;
	} else if ( version ) {
		// for tar.gz or alternative paths
		packageToInstall = version;
	}
	return packageToInstall;
}

function getTemporaryDirectory() {
	return new Promise( ( resolve, reject ) => {
		// Unsafe cleanup lets us recursively delete the directory if it contains
		// contents; by default it only allows removal if it's empty
		tmp.dir( { unsafeCleanup: true }, ( err, tmpdir, callback ) => {
			if ( err ) {
				reject( err );
			} else {
				resolve( {
					tmpdir: tmpdir,
					cleanup: () => {
						try {
							callback();
						} catch ( ignored ) {
							// Callback might throw and fail, since it's a temp directory the
							// OS will clean it up eventually...
						}
					},
				} );
			}
		} );
	} );
}

function extractStream( stream, dest ) {
	return new Promise( ( resolve, reject ) => {
		stream.pipe(
			unpack( dest, err => {
				if ( err ) {
					reject( err );
				} else {
					resolve( dest );
				}
			} )
		);
	} );
}

// Extract package name from tarball url or path.
function getPackageName( installPackage ) {
	if ( installPackage.indexOf( '.tgz' ) > -1 ) {
		return getTemporaryDirectory()
			.then( obj => {
				let stream;
				if ( /^http/.test( installPackage ) ) {
					stream = hyperquest( installPackage );
				} else {
					stream = fs.createReadStream( installPackage );
				}
				return extractStream( stream, obj.tmpdir ).then( () => obj );
			} )
			.then( obj => {
				const packageName = require( path.join( obj.tmpdir, 'package.json' ) ).name;
				obj.cleanup();
				return packageName;
			} )
			.catch( err => {
				// The package name could be with or without semver version, e.g.
				// react-scripts-0.2.0-alpha.1.tgz However, this function returns package name
				// only without semver version.
				console.log(
					`Could not extract the package name from the archive: ${err.message}`
				);
				const assumedProjectName = installPackage.match(
					/^.+\/(.+?)(?:-\d+.+)?\.tgz$/
				)[1];
				console.log(
					`Based on the filename, assuming it is "${chalk.cyan( assumedProjectName )}"`
				);
				return Promise.resolve( assumedProjectName );
			} );
	} else if ( installPackage.indexOf( 'git+' ) === 0 ) {
		// Pull package name out of git urls e.g:
		// git+https://github.com/mycompany/react-scripts.git
		// git+ssh://github.com/mycompany/react-scripts.git#v1.2.3
		return Promise.resolve( installPackage.match( /([^\/]+)\.git(#.*)?$/ )[1] );
	} else if ( installPackage.indexOf( '@' ) > 0 ) {
		// Do not match @scope/ when stripping off @version or @tag
		return Promise.resolve(
			installPackage.charAt( 0 ) + installPackage.substr( 1 ).split( '@' )[0]
		);
	}
	return Promise.resolve( installPackage );
}

function checkNpmVersion() {
	let hasMinNpm  = false;
	let npmVersion = null;
	try {
		npmVersion = execSync( 'npm --version' ).toString().trim();
		hasMinNpm  = semver.gte( npmVersion, '3.0.0' );
	} catch ( err ) {
		// ignore
	}
	return {
		hasMinNpm: hasMinNpm,
		npmVersion: npmVersion,
	};
}

function checkNodeVersion( packageName ) {
	const packageJsonPath = path.resolve(
		process.cwd(),
		'node_modules',
		packageName,
		'package.json'
	);
	const packageJson     = require( packageJsonPath );
	if ( !packageJson.engines || !packageJson.engines.node ) {
		return;
	}

	if ( !semver.satisfies( process.version, packageJson.engines.node ) ) {
		console.error(
			chalk.red(
				'You are running Node %s.\n' +
				'Create Divi Extension requires Node %s or higher. \n' +
				'Please update your version of Node.'
			),
			process.version,
			packageJson.engines.node
		);
		process.exit( 1 );
	}
}

function checkAppName( appName ) {
	const validationResult = validateProjectName( appName );
	if ( !validationResult.validForNewPackages ) {
		console.error(
			`Could not create a project called ${chalk.red( `"${appName}"` )} because of npm naming restrictions:`
		);
		printValidationResults( validationResult.errors );
		printValidationResults( validationResult.warnings );
		process.exit( 1 );
	}

	// TODO: there should be a single place that holds the dependencies
	const dependencies    = [];
	const devDependencies = ['react', 'react-dom', 'react-scripts'];
	const allDependencies = dependencies.concat( devDependencies ).sort();
	if ( allDependencies.indexOf( appName ) >= 0 ) {
		console.error(
			chalk.red(
				`We cannot create a project called ${chalk.green( appName )} because a dependency with the same name exists.\n` +
				`Due to the way npm works, the following names are not allowed:\n\n`
			) +
			chalk.cyan( allDependencies.map( depName => `  ${depName}` ).join( '\n' ) ) +
			chalk.red( '\n\nPlease choose a different project name.' )
		);
		process.exit( 1 );
	}
}

function makeCaretRange( dependencies, name ) {
	const version = dependencies[name];

	if ( typeof version === 'undefined' ) {
		console.error( chalk.red( `Missing ${name} dependency in package.json` ) );
		process.exit( 1 );
	}

	let patchedVersion = `^${version}`;

	if ( !semver.validRange( patchedVersion ) ) {
		console.error(
			`Unable to patch ${name} dependency version because version ${chalk.red( version )} will become invalid ${chalk.red( patchedVersion )}`
		);
		patchedVersion = version;
	}

	dependencies[name] = patchedVersion;
}

function fixDependencies( packageName ) {
	const packagePath = path.join( process.cwd(), 'package.json' );
	const packageJson = require( packagePath );

	if ( typeof packageJson.dependencies === 'undefined' ) {
		console.error( chalk.red( 'Missing dependencies in package.json' ) );
		process.exit( 1 );
	}

	const packageVersion = packageJson.dependencies[packageName];

	if ( typeof packageVersion === 'undefined' ) {
		console.error( chalk.red( `Unable to find ${packageName} in package.json` ) );
		process.exit( 1 );
	}

	packageJson.devDependencies              = packageJson.devDependencies || {};
	packageJson.devDependencies[packageName] = packageVersion;

	delete packageJson.dependencies[packageName];

	packageJson.devDependencies['react']     = packageJson.dependencies['react'];
	packageJson.devDependencies['react-dom'] = packageJson.dependencies['react-dom'];

	delete packageJson.dependencies['react'];
	delete packageJson.dependencies['react-dom'];

	makeCaretRange( packageJson.devDependencies, 'react' );
	makeCaretRange( packageJson.devDependencies, 'react-dom' );

	fs.writeFileSync( packagePath, JSON.stringify( packageJson, null, 2 ) );
}

// If project only contains files generated by GH, it’s safe.
// We also special case IJ-based products .idea because it integrates with CRA:
// https://github.com/lots0logs/create-divi-extension/pull/368#issuecomment-243446094
function isSafeToCreateProjectIn( root ) {
	const validFiles = [
		'.DS_Store',
		'Thumbs.db',
		'.git',
		'.gitignore',
		'.idea',
		'README.md',
		'LICENSE',
		'web.iml',
		'.hg',
		'.hgignore',
		'.hgcheck',
	];
	return fs.readdirSync( root ).every( file => validFiles.indexOf( file ) >= 0 );
}

function checkIfOnline( useYarn ) {
	if ( !useYarn ) {
		// Don't ping the Yarn registry.
		// We'll just assume the best case.
		return Promise.resolve( true );
	}

	return new Promise( resolve => {
		dns.lookup( 'registry.yarnpkg.com', err => {
			resolve( err === null );
		} );
	} );
}

function finalize_extension_files( root, appName ) {
	let end    = 4;
	let prefix = appName.replace( /^divi/igm, '' );
	let start  = ['-', '_'].includes( prefix[0] ) ? 1 : 0;

	prefix = prefix.substring( start, end ).toLowerCase();

	console.log(`prefix is: ${prefix}`);

	if ( ['-', '_'].includes( prefix[prefix.length - 1] ) ) {
		prefix = prefix.substring( 0, prefix.length -1 );
	}

	const PREFIX = prefix.toUpperCase();
	const Prefix = PREFIX.charAt(0) + prefix.slice(1);
	const files = [
		'template.php',
		'module/loader.php',
		'module/__Prefix_Custom.php',
	];

	for ( let file of files ) {
		const is_main_file = 'template.php' === file;
		const is_module    = 'module/__Prefix_Custom.php' === file;

		file = path.join( root, file );

		const data = fs.readFileSync( file, 'utf8' );

		const output = data
			.replace( /__Prefix/g, Prefix )
			.replace( /__PREFIX/g, PREFIX )
			.replace( /__prefix/g, prefix )
			.replace( /<NAME>/g, appName )
			.replace( /<GETTEXT_DOMAIN>/g, appName );

		fs.writeFileSync( file, output, 'utf8' );

		if ( is_main_file ) {
			fs.move( file, file.replace('template', path.basename( path.dirname( file ) ) ), err => {
				if ( err ) {
					console.error( err );
				}
			} );
		} else if ( is_module ) {
			fs.move( file, file.replace('__Prefix', Prefix ), err => {
				if ( err ) {
					console.error( err );
				}
			} );
		}
	}
}
