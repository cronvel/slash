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
var fsKit = require( 'fs-kit' ) ;
var path = require( 'path' ) ;
var os = require( 'os' ) ;



function pathCompletion( options , shell , startString , tokens , lastTokenIsEndOfInput , callback )
{
	var startToken , dirname , basename , currentPath , prefix ;
	
	if ( lastTokenIsEndOfInput && tokens.length )
	{
		startToken = tokens[ tokens.length - 1 ] ;
		
		dirname = startToken[ 0 ] === '~' ? os.homedir() + startToken.slice( 1 ) : startToken ;
		
		if ( dirname[ dirname.length - 1 ] === '/' )
		{
			basename = '' ;
		}
		else
		{
			dirname = path.dirname( dirname ) ;
			basename = path.basename( startToken ) ;
		}
		
		currentPath = path.isAbsolute( dirname ) ? dirname : shell.cwd + '/' + dirname ;
		prefix = startString.slice( 0 , startString.length - basename.length ) ;
	}
	else
	{
		startToken = '' ;
		currentPath = shell.cwd ;
		prefix = startString ;
		basename = '' ;
	}
	
	fsKit.readdir( currentPath , options , ( error , files ) => {
		if ( error ) { callback( undefined , startString ) ; return ; }
		
		var result = shell.produceCompletion( files , basename , true , prefix ) ;
		callback( undefined , result ) ;
    } ) ;
}



exports.path = pathCompletion.bind( exports , { slash: true } ) ;
exports.dirPath = pathCompletion.bind( exports , { slash: true , files: false } ) ;
exports.exePath = pathCompletion.bind( exports , { slash: true , exe: true } ) ;
exports.default = exports.path ;



exports.bin = function bin( shell , startString , tokens , lastTokenIsEndOfInput , callback )
{
	var startToken , prefix ;
	
	if ( ! lastTokenIsEndOfInput || ! tokens.length || ! shell.binPaths || ! shell.binPaths.length )
	{
		callback( undefined , startString ) ;
		return ;
	}
	
	startToken = tokens[ tokens.length - 1 ] ;
	
	if ( startToken.match( /\// ) )
	{
		// This is not a bin in the PATH, fallback to the 'path' autoCompleter
		return exports.exePath( shell , startString , tokens , lastTokenIsEndOfInput , callback ) ;
	}
	
	prefix = startString.slice( 0 , startString.length - startToken.length ) ;
	
	var result = shell.produceCompletion( shell.commandList , startToken , true , prefix ) ;
	callback( undefined , result ) ;
} ;


