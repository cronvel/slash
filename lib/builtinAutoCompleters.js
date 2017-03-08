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
var fsKit = require( 'fs-kit' ) ;
var path = require( 'path' ) ;
//var os = require( 'os' ) ;

var termkit = require( 'terminal-kit' ) ;



function pathCompletion( options , shell , startString , tokens , lastTokenIsEndOfInput , callback )
{
	var startToken , dirname , basename , currentPath , prefix ;
	
	if ( lastTokenIsEndOfInput && tokens.length )
	{
		startToken = tokens[ tokens.length - 1 ] ;
		
		if ( startToken[ startToken.length - 1 ] === '/' )
		{
			dirname = startToken ;
			basename = '' ;
		}
		else
		{
			dirname = path.dirname( startToken ) ;
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
	
	fsKit.readdir( currentPath , options , function( error , files ) {
		if ( error ) { callback( undefined , startString ) ; return ; }
		
		var result = termkit.autoComplete( files , basename , true , prefix ) ;
		callback( undefined , result ) ;
    } ) ;
}



exports.path = pathCompletion.bind( exports , { slash: true } ) ;
exports.dirPath = pathCompletion.bind( exports , { slash: true , noFiles: true } ) ;



exports.default = exports.path ;


