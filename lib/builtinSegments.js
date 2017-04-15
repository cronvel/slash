/*
	Next Gen Shell
	
	Copyright (c) 2017 Cédric Ronvel
	
	The MIT License (MIT)
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var path = require( 'path' ) ;
var os = require( 'os' ) ;
var fs = require( 'fs' ) ;
var fsKit = require( 'fs-kit' ) ;
var execFile = require( 'child_process' ).execFile ;

var babel = require( 'babel-tower' ).create() ;
var termkit = require( 'terminal-kit' ) ;



exports.fromString = function fromString( shell , options )
{
	shell.addSegment( babel.solve( options.str , shell.data ) , options ) ;
} ;



/*
	Current Working Directory segment.
	basename: only display the basename of the CWD (i.e.: the last part of the path)
*/
exports.cwd = function cwd( shell , options )
{
	var cwd = shell.cwd.replace( os.homedir() , '~' ) ;
	if ( options.basename ) { cwd = path.basename( cwd ) ; }
	shell.addSegment( cwd , options ) ;
} ;

exports.cwd.bgColor = '#555555' ;



/*
	User segment.
	hostname: add @hostname after the name
*/
exports.user = function user( shell , options )
{
	var userInfo = os.userInfo() ;
	var str = userInfo.username ;
	
	// If the user is root, turn the bg color to red!
	if ( userInfo.uid === 0 ) { options.bgColor = '#bc0000' ; }
	if ( options.hostname ) { str += '@' + os.hostname() ; }
	
	shell.addSegment( str , options ) ;
} ;

exports.user.bgColor = '#0088aa' ;



exports.hostname = function hostname( shell , options )
{
	shell.addSegment( os.hostname() , options ) ;
} ;

exports.hostname.bgColor = '#00aa88' ;



exports.uptime = function uptime( shell , options )
{
	var seconds = os.uptime() ;
	
	var days = Math.floor( seconds / 86400 ) ;
	seconds -= days * 86400 ;
	
	var hours = Math.floor( seconds / 3600 ) ;
	seconds -= hours * 3600 ;
	
	var minutes = Math.floor( seconds / 60 ) ;
	seconds -= minutes * 60 ;
	
	var str = days + 'D ' +
		( hours + ':' + minutes )
			.replace( /[0-9]+/g , match => match.length === 1 ? '0' + match : match ) ;
	
	shell.addSegment( str , options ) ;
} ;

exports.uptime.bgColor = '#555555' ;



exports.time = function time( shell , options )
{
	var time = new Date() ;
	
	var str = ( time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds() )
		.replace( /[0-9]+/g , match => match.length === 1 ? '0' + match : match ) ;
	
	shell.addSegment( str , options ) ;
} ;

exports.time.bgColor = '#555555' ;



/*
	Status of the last command segment: exit code and execution time.
	time: add execution time
*/
exports.commandStatus = function commandStatus( shell , options )
{
	// Probably no command was executed before
	if ( typeof shell.previousExitCode !== 'number' ) { return ; }
	
	var hours , minutes , seconds , str ;
	
	if ( shell.previousExitCode )
	{
		// Last command was KO
		options.bgColor = '#bc0000' ;
		str = '✘ ' + shell.previousExitCode ;
	}
	else
	{
		// Last command was OK
		options.bgColor = '#55aa00' ;
		str = '✔' ;
	}
	
	if ( options.time && shell.previousExecTime )
	{
		str += ' in ' ;
		
		if ( shell.previousExecTime < 2000 )
		{
			str += shell.previousExecTime + 'ms' ;
		}
		else if ( shell.previousExecTime < 60000 )
		{
			str += Math.round( shell.previousExecTime / 1000 ) + 's' ;
		}
		else if ( shell.previousExecTime < 3600000 )
		{
			seconds = Math.round( shell.previousExecTime / 1000 ) ;
			minutes = Math.floor( seconds / 60 ) ;
			seconds -= minutes * 60 ;
			str += ( minutes + ':' + seconds )
				.replace( /[0-9]+/g , match => match.length === 1 ? '0' + match : match ) ;
		}
		else
		{
			seconds = Math.round( shell.previousExecTime / 1000 ) ;
			hours = Math.floor( seconds / 3600 ) ;
			seconds -= hours * 3600 ;
			minutes = Math.floor( seconds / 60 ) ;
			seconds -= minutes * 60 ;
			str += ( hours + ':' + minutes + ':' + seconds )
				.replace( /[0-9]+/g , match => match.length === 1 ? '0' + match : match ) ;
		}
	}
	
	shell.addSegment( str , options ) ;
} ;



var heatColors = [
	'gray' ,
	//'magenta' ,
	'blue' ,
	'cyan' ,
	'green' ,
	'yellow' ,
	'brightYellow' ,
	'red' ,
	'brightRed' ,
	'brightRed'
] ;

exports.loadAvgBars = function loadAvgBars( shell , options )
{
	var str = '' , colorIndex , blockIndex ,
		cores = os.cpus().length ;
	
	os.loadavg().forEach( load => {
		
		load = 16 * Math.pow( load / Math.pow( cores , 0.9 ) , 0.8 ) ;
		
		if ( load >= 16 )
		{
			str += shell.term.str.bgBrightRed.yellow.bold( '!' ) ;
		}
		else
		{
			colorIndex = Math.floor( ( load + 1 ) / 2 ) ;
			blockIndex = Math.floor( load / 2 ) ;
			str += shell.term.str[ heatColors[ colorIndex ] ]( termkit.spChars.growingBlock[ blockIndex ] ) ;
		}
	} ) ;
	
	shell.addSegment( str , options ) ;
} ;

exports.loadAvgBars.bgColor = '#003355' ;



exports.git = function git( shell , options , callback )
{
	// Interesting commands:
	// get remote (but sometime it is not "origin" and fails): git config --get remote.origin.url
	// get the branch: git branch
	// great but slow: git status --porcelain -b
	// most recent tag: git describe --tags --always
	
	var env = {} ;
	Object.assign( env , shell.env ) ;
	var execOptions = { cwd: shell.cwd , env: env } ;
	
	// Comment from powerline: (https://github.com/banga/powerline-shell/blob/master/segments/git.py)
	// LANG is specified to ensure git always uses a language we are expecting.
	// Otherwise we may be unable to parse the output.
	env.LANG = 'C' ;
	
	fsKit.recursiveParentSearch( shell.cwd , '.git/config' , ( error , gitConfigPath ) => {
		
		// Not a git repo? not a problem, skip this segment
		if ( error ) { callback() ; return ; }
		
		//console.log( "\ngitConfigPath:" , gitConfigPath ) ;
		
		fs.readFile( gitConfigPath , ( error , content ) => {
			
			// What error? Still, we ignore that.
			if ( error ) { callback() ; return ; }
			
			content = content.toString() ;
			
			var match = content.match( /^\s+url\s+=\s+(\S+)\s*$/m ) ;
			if ( ! match ) { callback() ; return ; }
			
			var repo = match[ 1 ].replace( /^.*[:\/]/ , '' ).replace( /\..*$/ , '' ) ;
			
			//console.log( match ) ;
			
			execFile( 'git' , [ 'branch' ] , execOptions , ( error , stdout ) => {
				var match = stdout.toString().match( /^\* (.*)$/m ) ;
				var branch = match[ 1 ] ;
				
				shell.addSegment( repo + '  ' + branch , options ) ;
				
				callback() ;
			} ) ;
		} ) ;
	} ) ;
	
	// Alternative method, can be slow because of: git status --porcelain -b
	/*
	execFile( 'git' , [ 'status' , '--porcelain' , '-b' ] , execOptions , ( error , stdout ) => {
		if ( error ) { callback() ; return ; }
		
		stdout = stdout.toString() ;
		var match = stdout.match( /^## (.+)\.\.\.((?:([^\/]+)\/)?(.+))$/m ) ;
		var branch = match[ 1 ] ;
		var remote = match[ 2 ] ;
		var remoteName = match[ 3 ] ;
		var remoteBranch = match[ 4 ] ;
		//console.log( match ) ;
			
		execFile( 'git' , [ 'config' , '--get' , 'remote.' + remoteName + '.url' ] , execOptions , ( error , stdout ) => {
			if ( error ) { callback() ; return ; }
			
			var repo = stdout.toString().trim().replace( /^.*[:\/]/ , '' ).replace( /\..*$/ , '' ) ;
			
			//shell.addSegment( repo , options ) ;
			//shell.addSegment( ' ' + branch , options ) ;
			
			shell.addSegment( repo + '  ' + branch , options ) ;
			
			callback() ;
		} ) ;
	} ) ;
	*/
} ;

exports.git.bgColor = '#ff6600' ;


