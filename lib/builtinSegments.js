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



//var fs = require( 'fs' ) ;
var path = require( 'path' ) ;
var os = require( 'os' ) ;
var babel = require( 'babel-tower' ).create() ;
var termkit = require( 'terminal-kit' ) ;



exports.fromString = function fromString( shell , options )
{
	shell.term.markupOnly( babel.solve( options.str , shell.data ) ) ;
} ;



exports.cwd = function cwd( shell , options )
{
	shell.term( shell.cwd ) ;
} ;



exports.cwdBasename = function cwdBasename( shell , options )
{
	shell.term( path.basename( shell.cwd ) ) ;
} ;



exports.user = function user( shell , options )
{
	shell.term( os.userInfo().username ) ;
} ;



exports.hostname = function hostname( shell , options )
{
	shell.term( os.hostname() ) ;
} ;



exports.userAtHostname = function userAtHostname( shell , options )
{
	shell.term( os.userInfo().username + '@' + os.hostname() ) ;
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
	var colorIndex , blockIndex ,
		cores = os.cpus().length ;
	
	os.loadavg().forEach( load => {
		
		load = 16 * Math.pow( load / Math.pow( cores , 0.9 ) , 0.8 ) ;
		
		if ( load >= 16 )
		{
			shell.term.bgBrightRed.yellow.bold( '!' ) ;
		}
		else
		{
			colorIndex = Math.floor( ( load + 1 ) / 2 ) ;
			blockIndex = Math.floor( load / 2 ) ;
			shell.term[ heatColors[ colorIndex ] ]( termkit.spChars.growingBlock[ blockIndex ] ) ;
		}
	} ) ;
} ;


