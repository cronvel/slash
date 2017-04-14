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
//var fs = require( 'fs' ) ;
var fsKit = require( 'fs-kit' ) ;
var execFile = require( 'child_process' ).execFile ;

var babel = require( 'babel-tower' ).create() ;
var termkit = require( 'terminal-kit' ) ;



exports.fromString = function fromString( shell , options )
{
	shell.addSegment( babel.solve( options.str , shell.data ) , options ) ;
} ;



exports.cwd = function cwd( shell , options )
{
	shell.addSegment( shell.cwd , options ) ;
} ;



exports.cwdBasename = function cwdBasename( shell , options )
{
	shell.addSegment( path.basename( shell.cwd ) , options ) ;
} ;



exports.user = function user( shell , options )
{
	var userInfo = os.userInfo() ;
	
	// If the user is root, turn the bg color to red!
	if ( userInfo.uid === 0 ) { options.bgColor = '#bc0000' ; }
	
	shell.addSegment( userInfo.username , options ) ;
} ;



exports.hostname = function hostname( shell , options )
{
	shell.addSegment( os.hostname() , options ) ;
} ;



exports.userAtHostname = function userAtHostname( shell , options )
{
	shell.addSegment( os.userInfo().username + '@' + os.hostname() , options ) ;
} ;



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



exports.time = function time( shell , options )
{
	var time = new Date() ;
	
	var str = ( time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds() )
		.replace( /[0-9]+/g , match => match.length === 1 ? '0' + match : match ) ;
	
	shell.addSegment( str , options ) ;
} ;



exports.exitCode = function exitCode( shell , options )
{
	// Probably no command was executed before
	if ( typeof shell.previousExitCode !== 'number' ) { return ; }
	
	if ( shell.previousExitCode )
	{
		// Last command was KO
		options.bgColor = '#bc0000' ;
		shell.addSegment( '✘ ' + shell.previousExitCode , options ) ;
	}
	else
	{
		// Last command was OK
		options.bgColor = '#55aa00' ;
		shell.addSegment( '✔' , options ) ;
	}
} ;



exports.gitRepoBranch = function gitRepoBranch( shell , options , callback )
{
	// Interesting commands:
	// git config --get remote.origin.url
	// git branch
	// git status --porcelain -b
	// git describe --tags --always
	
	var env = {} ;
	Object.assign( env , shell.env ) ;
	var execOptions = { cwd: shell.cwd , env: env } ;
	
	// Comment from powerline: (https://github.com/banga/powerline-shell/blob/master/segments/git.py)
	// LANG is specified to ensure git always uses a language we are expecting.
	// Otherwise we may be unable to parse the output.
	env.LANG = 'C' ;
	
	execFile( 'git' , [ 'config' , '--get' , 'remote.origin.url' ] , execOptions , ( error , stdout ) => {
		if ( error ) { callback() ; return ; }
		
		stdout = stdout.toString().trim().replace( /^.*[:\/]/ , '' ).replace( /\..*$/ , '' ) ;
		
		shell.addSegment( stdout , options ) ;
		callback() ;
	} ) ;
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


