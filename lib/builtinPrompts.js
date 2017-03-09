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
//var path = require( 'path' ) ;
var os = require( 'os' ) ;
var babel = require( 'babel-tower' ).create() ;



exports.fromString = function fromString( shell , options )
{
	shell.term.markupOnly( babel.solve( options.str , shell.data ) ) ;
} ;



exports.loadAvgColors = function loadAvgColors( shell , options )
{
	var cores = os.cpus().length ;
	
	os.loadavg().forEach( load => {
		
		load = Math.round( 10 * Math.pow( load / Math.pow( cores , 0.9 ) , 0.8 ) ) ;
		
		switch ( load )
		{
			case 0 : shell.term.bgBrightBlack( ' ' ) ; break ;
			case 1 : shell.term.bgMagenta( ' ' ) ; break ;
			case 2 : shell.term.bgBlue( ' ' ) ; break ;
			case 3 : shell.term.bgBrightBlue( ' ' ) ; break ;
			case 4 : shell.term.bgCyan( ' ' ) ; break ;
			case 5 : shell.term.bgGreen( ' ' ) ; break ;
			case 6 : shell.term.bgBrightGreen( ' ' ) ; break ;
			case 7 : shell.term.bgBrightYellow( ' ' ) ; break ;
			case 8 : shell.term.bgRed( ' ' ) ; break ;
			case 9 : shell.term.bgBrightRed( ' ' ) ; break ;
			default : shell.term.bgBrightRed.yellow( '!' ) ; break ;
		}
	} ) ;
} ;


