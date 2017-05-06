/*
	Slash
	
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
		switch ( args[ 0 ][ 0 ] )
		{
			case '/' :
				cwd = args[ 0 ] ;
				break ;
			case '~' :
				cwd = os.homedir() + args[ 0 ].slice( 1 ) ;
				break ;
			default :
				cwd = path.join( shell.cwd , args[ 0 ] ) ;
				break ;
		}
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
			shell.term.cwd( 'file://' + cwd ) ;
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
	
	if ( ! args._.length )
	{
		shell.term.red( "Usage is:\nadd-segment <function> [<position>] [--options1 value1] [--options2 value2] [...]\n" ) ;
		return ;
	}
	
	args.fn = args._[ 0 ] ;
	
	if ( ! shell.segments[ args.fn ] )
	{
		shell.term.red( "Unknown segment\n" ) ;
		return ;
	}
	
	args.fn = shell.segments[ args.fn ] ;
	
	var position = parseInt( args._[ 1 ] , 10 ) ;
	
	position = isNaN( position ) ?
		shell.activeSegments.length :
		Math.max( 0 , Math.min( shell.activeSegments.length , position ) ) ;
	
	delete args._ ;
	
	shell.activeSegments.splice( position , 0 , args ) ;
} ;



exports['rm-segment'] = function removeSegment( shell , args )
{
	if ( ! args.length )
	{
		shell.term.red( "Usage is:\nrm-segment <position>\n" ) ;
		return ;
	}
	
	var position = parseInt( args[ 0 ] , 10 ) ;
	
	if ( isNaN( position ) || position < 0 || position >= shell.activeSegments.length )
	{
		shell.term.red( "Segment unexistant\n" ) ;
		return ;
	}
	
	shell.activeSegments.splice( position , 1 ) ;
} ;



exports.segments = function segments( shell , args )
{
	shell.activeSegments.forEach( ( e , index ) => {
		var key ;
		
		shell.term( '%i) %s\n' , index , e.fn.key ) ;
		
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


