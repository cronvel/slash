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



var fs = require( 'fs' ) ;
var path = require( 'path' ) ;
var os = require( 'os' ) ;

var minimist = require( 'minimist' ) ;



exports.cd = function cd( shell , args , callback )
{
	var cwd ;
	
	if ( args[ 0 ] )
	{
		cwd = path.join( shell.cwd , args[ 0 ] ) ;
	}
	else
	{
		// Empty cd, go to user home directory
		cwd = os.homedir() ;
	}
	
	cwd = path.resolve( cwd ) ;
	
	fs.stat( cwd , ( error , stats ) => {
		if ( error || ! stats.isDirectory() )
		{
			shell.term.red( "'%s' is not a directory\n" , cwd ) ;
		}
		else
		{
			shell.cwd = cwd ;
		}
		
		callback() ;
	} ) ;
} ;



exports.alias = function alias( shell , args )
{
	if ( args.length !== 2 )
	{
		shell.term.red( 'Syntax is:\nalias <alias-id> "<alias-text>"\n' ) ;
		return ;
	}
	
	if ( ! args[ 1 ].match( /^[^.\/\s][^\/\s]*$/ ) )
	{
		shell.term.red( 'Syntax error: the alias identifier should not start with a dot and contain slash and space\n' ) ;
		return ;
	}
	
	shell.aliases[ args[ 0 ] ] = args[ 1 ] ;
} ;



exports['rm-alias'] = function removeAlias( shell , args )
{
	if ( args[ 0 ] ) { delete shell.aliases[ args[ 0 ] ] ; }
} ;



exports.aliases = function aliases( shell , args )
{
	var alias ;
	
	for ( alias in shell.aliases )
	{
		shell.term.noFormat( alias + ' = ' + shell.aliases[ alias ] + '\n' ) ;
	}
} ;



exports['add-segment'] = function addSegment( shell , args )
{
	args = minimist( args ) ;
	// ------------------------------------------------ TODO --------------------------------------------------------
} ;



exports.segments = function segments( shell , args )
{
	shell.activeSegments.forEach( e => {
		var key ;
		
		shell.term( '%s:\n' , e.fn.key ) ;
		
		for ( key in e )
		{
			if ( key === 'fn' ) { continue ; }
			shell.term( '    %s: %s\n' , key , e[ key ] ) ;
		}
	} ) ;
} ;






// Remove camel-case?



exports.getAllEnv = function getAllEnv( shell )
{
	Object.keys( shell.env ).forEach( key => shell.term( "%s=%s\n" , key , shell.env[ key ] ) ) ;
} ;



exports.getEnv = function getEnv( shell , args )
{
	args.forEach( arg => shell.term( "%s\n" , shell.env[ arg ] ) ) ;
} ;



exports.setEnv = function setEnv( shell , args )
{
	if ( args.length >= 2 )
	{
		shell.env[ args[ 0 ] ] = args[ 1 ] ;
		//shell.term( "%s=%s\n" , args[ 0 ] , shell.env[ args[ 0 ] ] ) ;
	}
} ;


